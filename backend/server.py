from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import base64
import logging
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
import hashlib
import secrets
import httpx
import asyncio
import resend
import cloudinary
import cloudinary.uploader
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Image as RLImage,
    HRFlowable,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Resend configuration
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# Cloudinary configuration (Fase 5B: almacenamiento de logos/fotos)
cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME', ''),
    api_key=os.environ.get('CLOUDINARY_API_KEY', ''),
    api_secret=os.environ.get('CLOUDINARY_API_SECRET', ''),
    secure=True,
)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============ USER ROLE ENUM ============
class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    FACTURACION = "facturacion"

class UserStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

# ============ VACATION REQUEST STATUS ============
class VacationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

# ============ NOTIFICATION TYPE ============
class NotificationType(str, Enum):
    VACATION_APPROVED = "vacation_approved"
    VACATION_REJECTED = "vacation_rejected"
    USER_APPROVED = "user_approved"
    USER_REJECTED = "user_rejected"
    NEW_USER_REQUEST = "new_user_request"
    VACATION_REQUEST = "vacation_request"

# ============ EMAIL HELPER FUNCTIONS ============
async def send_notification_email(to_email: str, subject: str, html_content: str):
    """Send email notification using Resend"""
    if not resend.api_key or resend.api_key == 're_demo_key':
        logging.warning(f"Email not sent (demo mode): {subject} to {to_email}")
        return None
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Email sent to {to_email}: {subject}")
        return result
    except Exception as e:
        logging.error(f"Failed to send email: {str(e)}")
        return None

def create_vacation_email_html(user_name: str, fecha: str, tipo: str, status: str, comment: str = None):
    """Create HTML email for vacation notification"""
    tipo_text = "vacaciones" if tipo == "vacacion" else "día libre"
    status_text = "aprobada" if status == "approved" else "rechazada"
    status_color = "#10B981" if status == "approved" else "#EF4444"
    status_emoji = "✅" if status == "approved" else "❌"
    
    fecha_formatted = datetime.strptime(fecha, "%Y-%m-%d").strftime("%d de %B de %Y")
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">INICIA</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Gestión de Vacaciones</p>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1e293b; margin-top: 0;">Hola {user_name},</h2>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                Tu solicitud de <strong>{tipo_text}</strong> para el día <strong>{fecha_formatted}</strong> ha sido:
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; border: 2px solid {status_color};">
                <span style="font-size: 36px;">{status_emoji}</span>
                <p style="font-size: 20px; font-weight: bold; color: {status_color}; margin: 10px 0 0 0; text-transform: uppercase;">
                    {status_text}
                </p>
            </div>
    """
    
    if comment:
        html += f"""
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #92400e;"><strong>Comentario del administrador:</strong></p>
                <p style="margin: 10px 0 0 0; color: #78350f;">{comment}</p>
            </div>
        """
    
    html += """
            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                Puedes ver el estado de todas tus solicitudes en tu calendario personal.
            </p>
        </div>
        
        <div style="background: #1e293b; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                Este es un mensaje automático del sistema de gestión INICIA.
            </p>
        </div>
    </body>
    </html>
    """
    return html

async def create_notification(user_id: str, notification_type: str, title: str, message: str, data: dict = None):
    """Create in-app notification"""
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "data": data or {},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification.copy())
    return notification

async def notify_admins(notification_type: str, title: str, message: str, data: dict = None):
    """Send an in-app notification to every admin user."""
    admins = await db.users.find({"role": UserRole.ADMIN}, {"_id": 0, "user_id": 1}).to_list(1000)
    for admin in admins:
        await create_notification(
            user_id=admin["user_id"],
            notification_type=notification_type,
            title=title,
            message=message,
            data=data or {}
        )

# ============ AUTH MODELS ============
class UserBase(BaseModel):
    email: str
    name: str
    picture: Optional[str] = ""

class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    role: UserRole = UserRole.USER
    status: UserStatus = UserStatus.PENDING
    dias_vacaciones: int = 32
    dias_libres: int = 6
    color: str = "#3B82F6"
    abreviatura: str = ""

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None
    dias_vacaciones: Optional[int] = None
    dias_libres: Optional[int] = None
    color: Optional[str] = None
    abreviatura: Optional[str] = None

# Helper function to hash passwords
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# Helper to get current user from session
async def get_current_user(request: Request) -> dict:
    # Check cookie first
    session_token = request.cookies.get("session_token")
    
    # Then check Authorization header as fallback
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session in database
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry with timezone awareness
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

# Helper to require admin role
async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# Helper to require approved user
async def require_approved(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("status") != UserStatus.APPROVED and user.get("role") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Account pending approval")
    return user

# Budget Status Enum
class BudgetStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

# Estado del trabajo (control de trabajos jardineria)
class EstadoTrabajo(str, Enum):
    PENDIENTE_EJECUTAR = "pendiente_ejecutar"
    EJECUTADO = "ejecutado"
    FACTURADO = "facturado"
    ENVIADO = "enviado"
    MANTENIMIENTO = "mantenimiento"

# Estado del pedido a proveedor / parte (columna facturacion)
class PedidoPar(str, Enum):
    NINGUNO = "ninguno"
    ENVIADO = "enviado"
    PENDIENTE = "pendiente"

# Models
class BudgetBase(BaseModel):
    title: str
    client_name: str
    amount: float
    description: Optional[str] = ""
    status: BudgetStatus = BudgetStatus.PENDING

class BudgetCreate(BudgetBase):
    pass

class BudgetUpdate(BaseModel):
    title: Optional[str] = None
    client_name: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    status: Optional[BudgetStatus] = None

class Budget(BudgetBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EventBase(BaseModel):
    title: str
    date: str  # YYYY-MM-DD format
    start_time: Optional[str] = ""  # HH:MM format
    end_time: Optional[str] = ""  # HH:MM format
    description: Optional[str] = ""

class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    description: Optional[str] = None

class Event(EventBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Operario Model
class OperarioBase(BaseModel):
    nombre: str
    abreviatura: str  # Max 2-3 caracteres
    color: str  # Color hex como #FF0000
    dias_vacaciones: int = 22  # Días disponibles de vacaciones
    dias_libres: int = 6  # Días libres disponibles

class OperarioCreate(OperarioBase):
    pass

class OperarioUpdate(BaseModel):
    nombre: Optional[str] = None
    abreviatura: Optional[str] = None
    color: Optional[str] = None
    dias_vacaciones: Optional[int] = None
    dias_libres: Optional[int] = None

class Operario(OperarioBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    orden: int = 0  # Para ordenar los slots

# Vacaciones Model
class VacacionBase(BaseModel):
    operario_id: str
    fecha: str  # YYYY-MM-DD
    tipo: str = "vacacion"  # "vacacion" o "libre"

class VacacionCreate(VacacionBase):
    pass

class Vacacion(VacacionBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

# Budget Template Models
class MaterialItem(BaseModel):
    nombre: str = ""
    ud: str = ""
    precio: str = ""
    iva: str = "21"
    precio_coste: str = ""
    margen: str = "30"
    horas: str = ""
    litros: str = ""
    altura: str = ""
    notas: str = ""

class CostItem(BaseModel):
    ud: str = "1"
    precio: str = ""
    iva: str = "21"

# Modelo para cálculo de mano de obra
class CalculoManoObra(BaseModel):
    precioHora: str = ""
    numOperarios: str = ""
    horasJornada: str = ""
    numDias: str = ""
    dietasDia: str = ""
    alojamientoDia: str = ""
    extraDia: str = ""

# Modelo para porte con coste
class PorteItem(BaseModel):
    ud: str = "1"
    precio: str = ""
    iva: str = "21"
    precio_coste: str = ""
    margen: str = "30"

class BudgetTemplateBase(BaseModel):
    budget_number: str
    budget_date: str
    cliente: str
    # ID del cliente en la coleccion Client (opcional). Vinculacion Fase 4:
    # los presupuestos nuevos deberian traer este campo; los historicos se
    # localizan tambien por el texto de `cliente` (filtro OR en el endpoint).
    client_id: Optional[str] = None
    lugar_ejecucion: Optional[str] = ""
    provincia: Optional[str] = ""
    servicios_descripcion: Optional[str] = ""
    # ===== Campos Control de Trabajos (Excel) =====
    anio: Optional[int] = None
    num_orden: Optional[int] = None
    titulo: Optional[str] = ""
    centro: Optional[str] = ""
    solicitud_trabajo: Optional[str] = ""
    fecha_ejecucion: Optional[str] = ""
    estado_trabajo: EstadoTrabajo = EstadoTrabajo.PENDIENTE_EJECUTAR
    # ----- Columnas Facturacion -----
    pedido_cliente: Optional[str] = ""
    factura_inicio: Optional[str] = ""
    factura_proveedor: Optional[str] = ""
    importe_proveedor: Optional[float] = 0
    facturado: Optional[bool] = False
    pedido_par: PedidoPar = PedidoPar.NINGUNO
    anotaciones_facturacion: Optional[str] = ""
    materiales: List[MaterialItem] = []
    porte: Optional[PorteItem] = None
    mano_obra: Optional[CostItem] = None
    calculo_mano_obra: Optional[CalculoManoObra] = None
    observaciones: Optional[str] = ""
    total_base: float = 0
    total_iva: float = 0
    total_con_iva: float = 0
    status: BudgetStatus = BudgetStatus.PENDING

class BudgetTemplateCreate(BudgetTemplateBase):
    pass

class BudgetTemplateUpdate(BaseModel):
    budget_number: Optional[str] = None
    budget_date: Optional[str] = None
    cliente: Optional[str] = None
    client_id: Optional[str] = None
    lugar_ejecucion: Optional[str] = None
    provincia: Optional[str] = None
    servicios_descripcion: Optional[str] = None
    # ===== Campos Control de Trabajos (Excel) =====
    anio: Optional[int] = None
    num_orden: Optional[int] = None
    titulo: Optional[str] = None
    centro: Optional[str] = None
    solicitud_trabajo: Optional[str] = None
    fecha_ejecucion: Optional[str] = None
    estado_trabajo: Optional[EstadoTrabajo] = None
    pedido_cliente: Optional[str] = None
    factura_inicio: Optional[str] = None
    factura_proveedor: Optional[str] = None
    importe_proveedor: Optional[float] = None
    facturado: Optional[bool] = None
    pedido_par: Optional[PedidoPar] = None
    anotaciones_facturacion: Optional[str] = None
    materiales: Optional[List[MaterialItem]] = None
    porte: Optional[PorteItem] = None
    mano_obra: Optional[CostItem] = None
    calculo_mano_obra: Optional[CalculoManoObra] = None
    observaciones: Optional[str] = None
    total_base: Optional[float] = None
    total_iva: Optional[float] = None
    total_con_iva: Optional[float] = None
    status: Optional[BudgetStatus] = None

class BudgetTemplate(BudgetTemplateBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ AUTH ENDPOINTS ============

# Google OAuth session exchange
@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange Google OAuth session_id for our session"""
    data = await request.json()
    session_id = data.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get user data
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    async with httpx.AsyncClient() as client_http:
        try:
            auth_response = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            
            user_data = auth_response.json()
        except Exception as e:
            logging.error(f"Auth error: {e}")
            raise HTTPException(status_code=401, detail="Authentication failed")
    
    email = user_data.get("email")
    name = user_data.get("name", "")
    picture = user_data.get("picture", "")
    google_session_token = user_data.get("session_token")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
        user = existing_user
    else:
        # Create new user (pending approval)
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        abreviatura = name[:3].upper() if name else email[:3].upper()
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": UserRole.USER,
            "status": UserStatus.PENDING,
            "dias_vacaciones": 32,
            "dias_libres": 6,
            "color": "#3B82F6",
            "abreviatura": abreviatura,
            "auth_type": "google",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user.copy())
        await notify_admins(
            notification_type=NotificationType.NEW_USER_REQUEST,
            title="Nueva solicitud de acceso 🔔",
            message=f"{name} ({email}) se ha registrado y espera tu aprobación.",
            data={"user_id": user_id}
        )
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60  # 7 days
    )
    
    # Get fresh user data
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "user": user,
        "session_token": session_token
    }

# Email/Password Registration
@api_router.post("/auth/register")
async def register(user_data: UserCreate, response: Response):
    """Register new user with email/password"""
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    abreviatura = user_data.name[:3].upper() if user_data.name else user_data.email[:3].upper()
    
    user = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "picture": "",
        "role": UserRole.USER,
        "status": UserStatus.PENDING,
        "dias_vacaciones": 32,
        "dias_libres": 6,
        "color": "#3B82F6",
        "abreviatura": abreviatura,
        "auth_type": "email",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user.copy())
    await notify_admins(
        notification_type=NotificationType.NEW_USER_REQUEST,
        title="Nueva solicitud de acceso 🔔",
        message=f"{user_data.name} ({user_data.email}) se ha registrado y espera tu aprobación.",
        data={"user_id": user_id}
    )
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    # Remove password hash from response
    user.pop("password_hash", None)
    
    return {
        "user": user,
        "session_token": session_token
    }

# Email/Password Login
@api_router.post("/auth/login")
async def login(user_data: UserLogin, response: Response):
    """Login with email/password"""
    user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user registered with Google
    if user.get("auth_type") == "google":
        raise HTTPException(status_code=400, detail="Please use Google login for this account")
    
    # Verify password
    if user.get("password_hash") != hash_password(user_data.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    # Remove password hash from response
    user.pop("password_hash", None)
    
    return {
        "user": user,
        "session_token": session_token
    }

# Get current user
@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    user.pop("password_hash", None)
    return user

# Logout
@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return {"message": "Logged out successfully"}

# ============ ADMIN: USER MANAGEMENT ============

@api_router.get("/admin/users")
async def get_all_users(request: Request):
    """Get all users (admin only)"""
    await require_admin(request)
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.get("/admin/users/pending")
async def get_pending_users(request: Request):
    """Get pending users (admin only)"""
    await require_admin(request)
    users = await db.users.find({"status": UserStatus.PENDING}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.put("/admin/users/{user_id}")
async def update_user(user_id: str, user_update: UserUpdate, request: Request):
    """Update user (admin only)"""
    await require_admin(request)
    
    existing = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    if update_data:
        await db.users.update_one({"user_id": user_id}, {"$set": update_data})
    
    updated = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return updated

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete user (admin only)"""
    admin = await require_admin(request)
    
    if admin["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete user sessions and vacations
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.vacaciones.delete_many({"user_id": user_id})
    
    return {"message": "User deleted successfully"}

# ============ NOTIFICATIONS ENDPOINTS ============

@api_router.get("/notifications")
async def get_notifications(request: Request, unread_only: bool = False, limit: int = 50):
    """Get user's notifications"""
    user = await get_current_user(request)
    
    query = {"user_id": user["user_id"]}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return notifications

@api_router.get("/notifications/count")
async def get_unread_count(request: Request):
    """Get count of unread notifications"""
    user = await get_current_user(request)
    
    count = await db.notifications.count_documents({
        "user_id": user["user_id"],
        "read": False
    })
    return {"unread_count": count}

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark a notification as read"""
    user = await get_current_user(request)
    
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user["user_id"]},
        {"$set": {"read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

@api_router.post("/notifications/read-all")
async def mark_all_read(request: Request):
    """Mark all notifications as read"""
    user = await get_current_user(request)
    
    result = await db.notifications.update_many(
        {"user_id": user["user_id"], "read": False},
        {"$set": {"read": True}}
    )
    
    return {"message": f"Marked {result.modified_count} notifications as read"}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, request: Request):
    """Delete a notification"""
    user = await get_current_user(request)
    
    result = await db.notifications.delete_one({
        "id": notification_id,
        "user_id": user["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification deleted"}

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "Dashboard API"}

# ============ BUDGET ENDPOINTS ============

@api_router.get("/budgets", response_model=List[Budget])
async def get_budgets(status: Optional[BudgetStatus] = None):
    query = {}
    if status:
        query["status"] = status.value
    budgets = await db.budgets.find(query, {"_id": 0}).to_list(1000)
    for b in budgets:
        if isinstance(b.get('created_at'), str):
            b['created_at'] = datetime.fromisoformat(b['created_at'])
    return budgets

@api_router.get("/budgets/{budget_id}", response_model=Budget)
async def get_budget(budget_id: str):
    budget = await db.budgets.find_one({"id": budget_id}, {"_id": 0})
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    if isinstance(budget.get('created_at'), str):
        budget['created_at'] = datetime.fromisoformat(budget['created_at'])
    return budget

@api_router.post("/budgets", response_model=Budget)
async def create_budget(budget_data: BudgetCreate):
    budget = Budget(**budget_data.model_dump())
    doc = budget.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.budgets.insert_one(doc)
    return budget

@api_router.put("/budgets/{budget_id}", response_model=Budget)
async def update_budget(budget_id: str, budget_data: BudgetUpdate):
    existing = await db.budgets.find_one({"id": budget_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    update_data = {k: v for k, v in budget_data.model_dump().items() if v is not None}
    if update_data:
        await db.budgets.update_one({"id": budget_id}, {"$set": update_data})
    
    updated = await db.budgets.find_one({"id": budget_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return updated

@api_router.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str):
    result = await db.budgets.delete_one({"id": budget_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Budget not found")
    return {"message": "Budget deleted successfully"}

# ============ EVENT ENDPOINTS ============

@api_router.get("/events", response_model=List[Event])
async def get_events(date: Optional[str] = None, month: Optional[str] = None):
    query = {}
    if date:
        query["date"] = date
    elif month:
        # Filter by month (YYYY-MM format)
        query["date"] = {"$regex": f"^{month}"}
    events = await db.events.find(query, {"_id": 0}).to_list(1000)
    for e in events:
        if isinstance(e.get('created_at'), str):
            e['created_at'] = datetime.fromisoformat(e['created_at'])
    return events

@api_router.get("/events/{event_id}", response_model=Event)
async def get_event(event_id: str):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if isinstance(event.get('created_at'), str):
        event['created_at'] = datetime.fromisoformat(event['created_at'])
    return event

@api_router.post("/events", response_model=Event)
async def create_event(event_data: EventCreate):
    event = Event(**event_data.model_dump())
    doc = event.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.events.insert_one(doc)
    return event

@api_router.put("/events/{event_id}", response_model=Event)
async def update_event(event_id: str, event_data: EventUpdate):
    existing = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Event not found")
    
    update_data = {k: v for k, v in event_data.model_dump().items() if v is not None}
    if update_data:
        await db.events.update_one({"id": event_id}, {"$set": update_data})
    
    updated = await db.events.find_one({"id": event_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return updated

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    result = await db.events.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event deleted successfully"}

# ============ OPERARIOS ENDPOINTS ============

@api_router.get("/operarios", response_model=List[Operario])
async def get_operarios():
    operarios = await db.operarios.find({}, {"_id": 0}).sort("orden", 1).to_list(100)
    return operarios

@api_router.post("/operarios", response_model=Operario)
async def create_operario(operario_data: OperarioCreate):
    # Get next orden
    count = await db.operarios.count_documents({})
    operario = Operario(**operario_data.model_dump(), orden=count)
    doc = operario.model_dump()
    await db.operarios.insert_one(doc)
    return operario

@api_router.put("/operarios/{operario_id}", response_model=Operario)
async def update_operario(operario_id: str, operario_data: OperarioUpdate):
    existing = await db.operarios.find_one({"id": operario_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Operario not found")
    
    update_data = {k: v for k, v in operario_data.model_dump().items() if v is not None}
    if update_data:
        await db.operarios.update_one({"id": operario_id}, {"$set": update_data})
    
    updated = await db.operarios.find_one({"id": operario_id}, {"_id": 0})
    return updated

@api_router.delete("/operarios/{operario_id}")
async def delete_operario(operario_id: str):
    result = await db.operarios.delete_one({"id": operario_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Operario not found")
    # Also delete related vacaciones
    await db.vacaciones.delete_many({"operario_id": operario_id})
    return {"message": "Operario deleted successfully"}

# ============ VACACIONES ENDPOINTS (User-based) ============

# User's own vacations
@api_router.get("/my-vacaciones")
async def get_my_vacaciones(request: Request, month: Optional[str] = None, year: Optional[int] = None):
    """Get current user's vacations"""
    user = await require_approved(request)
    
    query = {"user_id": user["user_id"]}
    if month:
        query["fecha"] = {"$regex": f"^{month}"}
    elif year:
        query["fecha"] = {"$regex": f"^{year}"}
    
    vacaciones = await db.vacaciones.find(query, {"_id": 0}).to_list(10000)
    return vacaciones

@api_router.post("/my-vacaciones")
async def create_my_vacacion(request: Request, fecha: str, tipo: str = "vacacion"):
    """Create vacation request for current user (status: pending)"""
    user = await require_approved(request)
    
    # Check if already exists
    existing = await db.vacaciones.find_one({
        "user_id": user["user_id"],
        "fecha": fecha
    }, {"_id": 0})
    
    if existing:
        # If pending, can toggle off (cancel request)
        if existing.get("status") == VacationStatus.PENDING:
            await db.vacaciones.delete_one({"user_id": user["user_id"], "fecha": fecha})
            return {"message": "Request cancelled", "action": "deleted"}
        # If approved, cannot modify
        elif existing.get("status") == VacationStatus.APPROVED:
            raise HTTPException(status_code=400, detail="Cannot modify approved vacation")
        # If rejected, can create new request
        elif existing.get("status") == VacationStatus.REJECTED:
            await db.vacaciones.delete_one({"user_id": user["user_id"], "fecha": fecha})
    
    # Create new request (always pending)
    vacacion = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "fecha": fecha,
        "tipo": tipo,
        "status": VacationStatus.PENDING,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "reviewed_by": None,
        "rejection_comment": None
    }
    await db.vacaciones.insert_one(vacacion.copy())  # Insert copy to avoid _id mutation
    
    # Notify admins of the new vacation request
    tipo_text = "vacaciones" if tipo == "vacacion" else "día libre"
    try:
        fecha_fmt = datetime.strptime(fecha, "%Y-%m-%d").strftime("%d/%m/%Y")
    except ValueError:
        fecha_fmt = fecha
    await notify_admins(
        notification_type=NotificationType.VACATION_REQUEST,
        title="Nueva solicitud de vacaciones 📅",
        message=f"{user.get('name', '')} ha solicitado {tipo_text} para el {fecha_fmt}.",
        data={"user_id": user["user_id"], "fecha": fecha, "tipo": tipo}
    )
    
    # Add user info for response
    vacacion["user_name"] = user.get("name", "")
    vacacion["user_color"] = user.get("color", "#3B82F6")
    vacacion["user_abreviatura"] = user.get("abreviatura", "")
    
    return {"message": "Request created", "action": "created", "vacacion": vacacion}

@api_router.delete("/my-vacaciones/{fecha}")
async def delete_my_vacacion(fecha: str, request: Request):
    """Cancel pending vacation request for current user"""
    user = await require_approved(request)
    
    # Check if exists and is pending
    existing = await db.vacaciones.find_one({
        "user_id": user["user_id"],
        "fecha": fecha
    }, {"_id": 0})
    
    if not existing:
        raise HTTPException(status_code=404, detail="Vacation not found")
    
    if existing.get("status") == VacationStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Cannot cancel approved vacation. Contact admin.")
    
    result = await db.vacaciones.delete_one({"user_id": user["user_id"], "fecha": fecha})
    return {"message": "Request cancelled successfully"}

@api_router.get("/my-vacaciones/resumen")
async def get_my_resumen(request: Request, year: Optional[int] = None):
    """Get current user's vacation summary"""
    user = await require_approved(request)
    
    if not year:
        year = datetime.now().year
    
    # Count APPROVED vacaciones for this year
    vacaciones_approved = await db.vacaciones.count_documents({
        "user_id": user["user_id"],
        "fecha": {"$regex": f"^{year}"},
        "tipo": "vacacion",
        "status": VacationStatus.APPROVED
    })
    # Count PENDING vacaciones
    vacaciones_pending = await db.vacaciones.count_documents({
        "user_id": user["user_id"],
        "fecha": {"$regex": f"^{year}"},
        "tipo": "vacacion",
        "status": VacationStatus.PENDING
    })
    
    # Count APPROVED dias libres for this year
    libres_approved = await db.vacaciones.count_documents({
        "user_id": user["user_id"],
        "fecha": {"$regex": f"^{year}"},
        "tipo": "libre",
        "status": VacationStatus.APPROVED
    })
    # Count PENDING dias libres
    libres_pending = await db.vacaciones.count_documents({
        "user_id": user["user_id"],
        "fecha": {"$regex": f"^{year}"},
        "tipo": "libre",
        "status": VacationStatus.PENDING
    })
    
    dias_vacaciones_disponibles = user.get("dias_vacaciones", 32)
    dias_libres_disponibles = user.get("dias_libres", 6)
    
    return {
        "user_id": user["user_id"],
        "nombre": user.get("name", ""),
        "email": user.get("email", ""),
        "abreviatura": user.get("abreviatura", ""),
        "color": user.get("color", "#3B82F6"),
        # Vacaciones
        "dias_disponibles": dias_vacaciones_disponibles,
        "dias_aprobados": vacaciones_approved,
        "dias_pendientes": vacaciones_pending,
        "dias_restantes": dias_vacaciones_disponibles - vacaciones_approved,
        # Días libres
        "dias_libres_disponibles": dias_libres_disponibles,
        "dias_libres_aprobados": libres_approved,
        "dias_libres_pendientes": libres_pending,
        "dias_libres_restantes": dias_libres_disponibles - libres_approved,
    }

# Admin: Get all users' vacations (for admin calendar view)
@api_router.get("/admin/vacaciones")
async def get_all_vacaciones(request: Request, month: Optional[str] = None, year: Optional[int] = None, status: Optional[str] = None):
    """Get all users' vacations (admin only)"""
    await require_admin(request)
    
    query = {}
    if month:
        query["fecha"] = {"$regex": f"^{month}"}
    elif year:
        query["fecha"] = {"$regex": f"^{year}"}
    if status:
        query["status"] = status
    
    vacaciones = await db.vacaciones.find(query, {"_id": 0}).to_list(10000)
    
    # Enrich with user info
    users_cache = {}
    for v in vacaciones:
        user_id = v.get("user_id")
        if user_id not in users_cache:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
            users_cache[user_id] = user
        user = users_cache.get(user_id)
        if user:
            v["user_name"] = user.get("name", "")
            v["user_color"] = user.get("color", "#3B82F6")
            v["user_abreviatura"] = user.get("abreviatura", "")
            v["user_email"] = user.get("email", "")
    
    return vacaciones

# Admin: Get pending requests
@api_router.get("/admin/vacaciones/pending")
async def get_pending_vacaciones(request: Request):
    """Get all pending vacation requests (admin only)"""
    await require_admin(request)
    
    vacaciones = await db.vacaciones.find({"status": VacationStatus.PENDING}, {"_id": 0}).to_list(10000)
    
    # Enrich with user info
    users_cache = {}
    for v in vacaciones:
        user_id = v.get("user_id")
        if user_id not in users_cache:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
            users_cache[user_id] = user
        user = users_cache.get(user_id)
        if user:
            v["user_name"] = user.get("name", "")
            v["user_color"] = user.get("color", "#3B82F6")
            v["user_abreviatura"] = user.get("abreviatura", "")
            v["user_email"] = user.get("email", "")
    
    return vacaciones

# Admin: Approve vacation request
@api_router.post("/admin/vacaciones/{vacacion_id}/approve")
async def approve_vacacion(vacacion_id: str, request: Request):
    """Approve a vacation request (admin only)"""
    admin = await require_admin(request)
    
    vacacion = await db.vacaciones.find_one({"id": vacacion_id}, {"_id": 0})
    if not vacacion:
        raise HTTPException(status_code=404, detail="Vacation request not found")
    
    if vacacion.get("status") != VacationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    # Update vacation status
    await db.vacaciones.update_one(
        {"id": vacacion_id},
        {"$set": {
            "status": VacationStatus.APPROVED,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": admin["user_id"]
        }}
    )
    
    # Get user info for notification
    user = await db.users.find_one({"user_id": vacacion["user_id"]}, {"_id": 0})
    if user:
        tipo_text = "vacaciones" if vacacion["tipo"] == "vacacion" else "día libre"
        fecha_formatted = datetime.strptime(vacacion["fecha"], "%Y-%m-%d").strftime("%d/%m/%Y")
        
        # Create in-app notification
        await create_notification(
            user_id=user["user_id"],
            notification_type=NotificationType.VACATION_APPROVED,
            title="Solicitud aprobada ✅",
            message=f"Tu solicitud de {tipo_text} para el {fecha_formatted} ha sido aprobada.",
            data={"vacacion_id": vacacion_id, "fecha": vacacion["fecha"]}
        )
        
        # Send email notification
        email_html = create_vacation_email_html(
            user_name=user.get("name", "Usuario"),
            fecha=vacacion["fecha"],
            tipo=vacacion["tipo"],
            status="approved"
        )
        asyncio.create_task(send_notification_email(
            to_email=user.get("email"),
            subject="✅ Tu solicitud de vacaciones ha sido aprobada",
            html_content=email_html
        ))
    
    return {"message": "Vacation approved successfully"}

# Admin: Reject vacation request
@api_router.post("/admin/vacaciones/{vacacion_id}/reject")
async def reject_vacacion(vacacion_id: str, request: Request, comment: Optional[str] = None):
    """Reject a vacation request (admin only)"""
    admin = await require_admin(request)
    
    vacacion = await db.vacaciones.find_one({"id": vacacion_id}, {"_id": 0})
    if not vacacion:
        raise HTTPException(status_code=404, detail="Vacation request not found")
    
    if vacacion.get("status") != VacationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    # Update vacation status
    await db.vacaciones.update_one(
        {"id": vacacion_id},
        {"$set": {
            "status": VacationStatus.REJECTED,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": admin["user_id"],
            "rejection_comment": comment
        }}
    )
    
    # Get user info for notification
    user = await db.users.find_one({"user_id": vacacion["user_id"]}, {"_id": 0})
    if user:
        tipo_text = "vacaciones" if vacacion["tipo"] == "vacacion" else "día libre"
        fecha_formatted = datetime.strptime(vacacion["fecha"], "%Y-%m-%d").strftime("%d/%m/%Y")
        
        message = f"Tu solicitud de {tipo_text} para el {fecha_formatted} ha sido rechazada."
        if comment:
            message += f" Motivo: {comment}"
        
        # Create in-app notification
        await create_notification(
            user_id=user["user_id"],
            notification_type=NotificationType.VACATION_REJECTED,
            title="Solicitud rechazada ❌",
            message=message,
            data={"vacacion_id": vacacion_id, "fecha": vacacion["fecha"], "comment": comment}
        )
        
        # Send email notification
        email_html = create_vacation_email_html(
            user_name=user.get("name", "Usuario"),
            fecha=vacacion["fecha"],
            tipo=vacacion["tipo"],
            status="rejected",
            comment=comment
        )
        asyncio.create_task(send_notification_email(
            to_email=user.get("email"),
            subject="❌ Tu solicitud de vacaciones ha sido rechazada",
            html_content=email_html
        ))
    
    return {"message": "Vacation rejected successfully"}

# Admin: Bulk approve/reject
@api_router.post("/admin/vacaciones/bulk-action")
async def bulk_action_vacaciones(request: Request):
    """Bulk approve or reject vacation requests (admin only)"""
    admin = await require_admin(request)
    data = await request.json()
    
    ids = data.get("ids", [])
    action = data.get("action")  # "approve" or "reject"
    comment = data.get("comment")
    
    if not ids or action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid request")
    
    new_status = VacationStatus.APPROVED if action == "approve" else VacationStatus.REJECTED
    
    update_data = {
        "status": new_status,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": admin["user_id"]
    }
    if action == "reject" and comment:
        update_data["rejection_comment"] = comment
    
    result = await db.vacaciones.update_many(
        {"id": {"$in": ids}, "status": VacationStatus.PENDING},
        {"$set": update_data}
    )
    
    return {"message": f"{result.modified_count} requests {action}d successfully"}

@api_router.get("/admin/vacaciones/resumen")
async def get_all_resumen(request: Request, year: Optional[int] = None):
    """Get all users' vacation summary (admin only)"""
    await require_admin(request)
    
    if not year:
        year = datetime.now().year
    
    # Get all approved users
    users = await db.users.find({"status": UserStatus.APPROVED}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    resumen = []
    for user in users:
        # Count APPROVED vacaciones for this year
        vacaciones_approved = await db.vacaciones.count_documents({
            "user_id": user["user_id"],
            "fecha": {"$regex": f"^{year}"},
            "tipo": "vacacion",
            "status": VacationStatus.APPROVED
        })
        vacaciones_pending = await db.vacaciones.count_documents({
            "user_id": user["user_id"],
            "fecha": {"$regex": f"^{year}"},
            "tipo": "vacacion",
            "status": VacationStatus.PENDING
        })
        # Count APPROVED dias libres for this year
        libres_approved = await db.vacaciones.count_documents({
            "user_id": user["user_id"],
            "fecha": {"$regex": f"^{year}"},
            "tipo": "libre",
            "status": VacationStatus.APPROVED
        })
        libres_pending = await db.vacaciones.count_documents({
            "user_id": user["user_id"],
            "fecha": {"$regex": f"^{year}"},
            "tipo": "libre",
            "status": VacationStatus.PENDING
        })
        
        dias_vacaciones_disponibles = user.get("dias_vacaciones", 32)
        dias_libres_disponibles = user.get("dias_libres", 6)
        
        resumen.append({
            "user_id": user["user_id"],
            "nombre": user.get("name", ""),
            "email": user.get("email", ""),
            "abreviatura": user.get("abreviatura", ""),
            "color": user.get("color", "#3B82F6"),
            # Vacaciones
            "dias_disponibles": dias_vacaciones_disponibles,
            "dias_aprobados": vacaciones_approved,
            "dias_pendientes": vacaciones_pending,
            "dias_restantes": dias_vacaciones_disponibles - vacaciones_approved,
            # Días libres
            "dias_libres_disponibles": dias_libres_disponibles,
            "dias_libres_aprobados": libres_approved,
            "dias_libres_pendientes": libres_pending,
            "dias_libres_restantes": dias_libres_disponibles - libres_approved,
        })
    
    return resumen

# Legacy endpoints for backwards compatibility (admin only now)
@api_router.get("/vacaciones")
async def get_vacaciones(request: Request, month: Optional[str] = None):
    """Get vacaciones - redirects based on role"""
    try:
        user = await get_current_user(request)
        if user.get("role") == UserRole.ADMIN:
            query = {}
            if month:
                query["fecha"] = {"$regex": f"^{month}"}
            vacaciones = await db.vacaciones.find(query, {"_id": 0}).to_list(10000)
            return vacaciones
        else:
            # Return only user's vacations
            query = {"user_id": user["user_id"]}
            if month:
                query["fecha"] = {"$regex": f"^{month}"}
            vacaciones = await db.vacaciones.find(query, {"_id": 0}).to_list(10000)
            return vacaciones
    except:
        return []

@api_router.get("/vacaciones/resumen")
async def get_vacaciones_resumen(request: Request, year: Optional[int] = None):
    """Get vacation summary - redirects based on role"""
    try:
        user = await get_current_user(request)
        if user.get("role") == UserRole.ADMIN:
            return await get_all_resumen(request, year)
        else:
            return [await get_my_resumen(request, year)]
    except:
        return []

# ============ BUDGET TEMPLATE ENDPOINTS ============

@api_router.get("/budget-templates", response_model=List[BudgetTemplate])
async def get_budget_templates(status: Optional[BudgetStatus] = None):
    query = {}
    if status:
        query["status"] = status.value
    templates = await db.budget_templates.find(query, {"_id": 0}).to_list(1000)
    for t in templates:
        if isinstance(t.get('created_at'), str):
            t['created_at'] = datetime.fromisoformat(t['created_at'])
    return templates

@api_router.get("/budget-templates/{template_id}", response_model=BudgetTemplate)
async def get_budget_template(template_id: str):
    template = await db.budget_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Budget template not found")
    if isinstance(template.get('created_at'), str):
        template['created_at'] = datetime.fromisoformat(template['created_at'])
    return template

@api_router.post("/budget-templates", response_model=BudgetTemplate)
async def create_budget_template(template_data: BudgetTemplateCreate):
    template = BudgetTemplate(**template_data.model_dump())
    doc = template.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    # Convert nested models to dicts
    if doc.get('materiales'):
        doc['materiales'] = [m if isinstance(m, dict) else m.model_dump() for m in doc['materiales']]
    if doc.get('porte'):
        doc['porte'] = doc['porte'] if isinstance(doc['porte'], dict) else doc['porte'].model_dump()
    if doc.get('mano_obra'):
        doc['mano_obra'] = doc['mano_obra'] if isinstance(doc['mano_obra'], dict) else doc['mano_obra'].model_dump()
    if doc.get('calculo_mano_obra'):
        doc['calculo_mano_obra'] = doc['calculo_mano_obra'] if isinstance(doc['calculo_mano_obra'], dict) else doc['calculo_mano_obra'].model_dump()
    await db.budget_templates.insert_one(doc)
    return template

@api_router.put("/budget-templates/{template_id}", response_model=BudgetTemplate)
async def update_budget_template(template_id: str, template_data: BudgetTemplateUpdate):
    existing = await db.budget_templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Budget template not found")
    
    update_data = {}
    for k, v in template_data.model_dump().items():
        if v is not None:
            if k == 'materiales' and v:
                update_data[k] = [m if isinstance(m, dict) else m.model_dump() for m in v]
            elif k in ['porte', 'mano_obra', 'calculo_mano_obra'] and v:
                update_data[k] = v if isinstance(v, dict) else v.model_dump()
            else:
                update_data[k] = v
    
    if update_data:
        await db.budget_templates.update_one({"id": template_id}, {"$set": update_data})
    
    updated = await db.budget_templates.find_one({"id": template_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return updated

@api_router.delete("/budget-templates/{template_id}")
async def delete_budget_template(template_id: str):
    result = await db.budget_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Budget template not found")
    return {"message": "Budget template deleted successfully"}

# ============ DASHBOARD STATS ============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    # Count from budget_templates collection now
    total_budgets = await db.budget_templates.count_documents({})
    pending_budgets = await db.budget_templates.count_documents({"status": "pending"})
    approved_budgets = await db.budget_templates.count_documents({"status": "approved"})
    rejected_budgets = await db.budget_templates.count_documents({"status": "rejected"})
    
    # Get total amount of approved budgets (SIN IVA - total_base)
    pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_base"}}}
    ]
    result = await db.budget_templates.aggregate(pipeline).to_list(1)
    total_approved_amount = result[0]["total"] if result else 0
    
    # Get upcoming events (today and future)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    upcoming_events = await db.events.count_documents({"date": {"$gte": today}})
    
    return {
        "total_budgets": total_budgets,
        "pending_budgets": pending_budgets,
        "approved_budgets": approved_budgets,
        "rejected_budgets": rejected_budgets,
        "total_approved_amount": total_approved_amount,
        "upcoming_events": upcoming_events
    }

# =====================================================================
# CLIENTES (Fase 2)
# ---------------------------------------------------------------------
# Modelo Client + endpoints REST.
# Los 7 clientes iniciales se auto-siembran al arrancar la app si la
# colección está vacía (ver seed_clients_if_empty).
#
# NOTA DE ARQUITECTURA (logo) - actualizada en Fase 5B:
# El frontend sigue enviando el logo como data-URI base64 en logo_url
# (sin cambios ahi). El backend, al crear o actualizar un cliente, detecta
# si logo_url es un data-URI y en ese caso lo sube a Cloudinary y guarda
# la URL resultante (mas logo_public_id, para poder borrar el asset viejo
# cuando se reemplaza). MongoDB deja de usarse como almacen de binarios.
# Ver _es_logo_base64 / _subir_logo_cloudinary / _borrar_logo_cloudinary.
#
# NOTA DE SEGURIDAD:
# Lectura permitida a cualquier usuario aprobado (mismo patrón que
# budget-templates: la restricción admin+facturación se aplica en el
# frontend). Escritura restringida a admin.
# =====================================================================

import re

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class ClientBase(BaseModel):
    slug: str = Field(..., description="Identificador URL-friendly, único y estable")
    nombre: str = Field(..., min_length=1, max_length=120)
    logo_url: Optional[str] = Field(None, description="Data-URI base64 (entrada) o URL de Cloudinary (salida)")
    notas: Optional[str] = Field("", max_length=2000)


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    # Todos opcionales: PUT parcial. El slug NO se puede cambiar una vez creado
    # (rompería URLs y referencias futuras desde otras colecciones).
    nombre: Optional[str] = Field(None, min_length=1, max_length=120)
    logo_url: Optional[str] = None
    notas: Optional[str] = Field(None, max_length=2000)
    activo: Optional[bool] = None


class Client(ClientBase):
    id: str
    activo: bool = True
    creado_en: datetime
    actualizado_en: datetime
    logo_public_id: Optional[str] = Field(
        None, description="ID interno del asset en Cloudinary, para poder borrarlo al reemplazar el logo."
    )


def _es_logo_base64(valor: Optional[str]) -> bool:
    return bool(valor) and valor.startswith("data:image")


async def _subir_logo_cloudinary(data_uri: str) -> tuple:
    """Sube un logo (data-URI base64) a Cloudinary. Devuelve (url, public_id)."""
    try:
        resultado = await asyncio.to_thread(
            cloudinary.uploader.upload,
            data_uri,
            folder="inicia-gestion/clientes",
            resource_type="image",
        )
    except Exception as e:
        logger.error("Error subiendo logo a Cloudinary", exc_info=True)
        raise HTTPException(status_code=502, detail="No se pudo subir el logo") from e
    return resultado["secure_url"], resultado["public_id"]


async def _borrar_logo_cloudinary(public_id: Optional[str]) -> None:
    """Borra un asset de Cloudinary. Nunca lanza excepcion: si falla, se
    queda huerfano en Cloudinary pero no debe romper la operacion del
    usuario (crear/actualizar un cliente)."""
    if not public_id:
        return
    try:
        await asyncio.to_thread(cloudinary.uploader.destroy, public_id)
    except Exception:
        logger.warning("No se pudo borrar un logo antiguo de Cloudinary", exc_info=True)


def _validate_slug(slug: str) -> str:
    slug = (slug or "").strip().lower()
    if not _SLUG_RE.match(slug):
        raise HTTPException(
            status_code=400,
            detail="slug inválido: usa minúsculas, números y guiones (ej. 'leroy-merlin')",
        )
    return slug


# Los 7 clientes iniciales que el frontend usaba hardcodeados.
# Los slugs coinciden EXACTAMENTE con los ids del array del frontend
# para que URLs ya en uso (/clients/sanitas, etc.) sigan resolviendo.
_SEED_CLIENTS = [
    {"slug": "sanitas", "nombre": "SANITAS"},
    {"slug": "leroy-merlin", "nombre": "LEROY MERLIN"},
    {"slug": "ikea", "nombre": "IKEA"},
    {"slug": "iberdrola", "nombre": "IBERDROLA"},
    {"slug": "style-outlet", "nombre": "STYLE OUTLET"},
    {"slug": "clarins", "nombre": "CLARINS"},
    {"slug": "galp", "nombre": "GALP"},
]


async def seed_clients_if_empty() -> None:
    """Inserta los 7 clientes iniciales si la colección está vacía. Idempotente."""
    count = await db.clients.count_documents({})
    if count > 0:
        return
    now = datetime.now(timezone.utc)
    docs = [
        {
            "id": str(uuid.uuid4()),
            "slug": c["slug"],
            "nombre": c["nombre"],
            "logo_url": None,
            "notas": "",
            "activo": True,
            "creado_en": now,
            "actualizado_en": now,
        }
        for c in _SEED_CLIENTS
    ]
    await db.clients.insert_many(docs)


@api_router.get("/clients", response_model=List[Client])
async def list_clients(_: dict = Depends(require_approved)):
    """Lista de clientes activos, orden alfabético por nombre."""
    cursor = db.clients.find({"activo": True}).sort("nombre", 1)
    return [Client(**doc) async for doc in cursor]


@api_router.get("/clients/{slug}", response_model=Client)
async def get_client(slug: str, _: dict = Depends(require_approved)):
    slug = _validate_slug(slug)
    doc = await db.clients.find_one({"slug": slug, "activo": True})
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return Client(**doc)


@api_router.post("/clients", response_model=Client)
async def create_client(payload: ClientCreate, _: dict = Depends(require_admin)):
    slug = _validate_slug(payload.slug)
    existing = await db.clients.find_one({"slug": slug})
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe un cliente con ese slug")
    now = datetime.now(timezone.utc)
    logo_url = payload.logo_url
    logo_public_id = None
    if _es_logo_base64(logo_url):
        logo_url, logo_public_id = await _subir_logo_cloudinary(logo_url)
    doc = {
        "id": str(uuid.uuid4()),
        "slug": slug,
        "nombre": payload.nombre.strip(),
        "logo_url": logo_url,
        "logo_public_id": logo_public_id,
        "notas": (payload.notas or "").strip(),
        "activo": True,
        "creado_en": now,
        "actualizado_en": now,
    }
    await db.clients.insert_one(doc)
    return Client(**doc)


@api_router.put("/clients/{client_id}", response_model=Client)
async def update_client(
    client_id: str, payload: ClientUpdate, _: dict = Depends(require_admin)
):
    doc = await db.clients.find_one({"id": client_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not updates:
        return Client(**doc)
    if "nombre" in updates and updates["nombre"] is not None:
        updates["nombre"] = updates["nombre"].strip()
    if "notas" in updates and updates["notas"] is not None:
        updates["notas"] = updates["notas"].strip()

    if "logo_url" in updates:
        nuevo_logo = updates["logo_url"]
        if _es_logo_base64(nuevo_logo):
            # Logo nuevo: subir a Cloudinary y borrar el anterior (si habia)
            url, public_id = await _subir_logo_cloudinary(nuevo_logo)
            await _borrar_logo_cloudinary(doc.get("logo_public_id"))
            updates["logo_url"] = url
            updates["logo_public_id"] = public_id
        elif nuevo_logo is None and doc.get("logo_public_id"):
            # Logo eliminado explicitamente
            await _borrar_logo_cloudinary(doc.get("logo_public_id"))
            updates["logo_public_id"] = None

    updates["actualizado_en"] = datetime.now(timezone.utc)
    await db.clients.update_one({"id": client_id}, {"$set": updates})
    doc = await db.clients.find_one({"id": client_id})
    return Client(**doc)


@api_router.post("/admin/clients/migrar-logos-cloudinary")
async def migrar_logos_cloudinary(_: dict = Depends(require_admin)):
    """Tarea puntual (Fase 5B): sube a Cloudinary los logos que aun esten
    en base64 dentro de MongoDB (clientes creados/sembrados antes de esta
    fase). Idempotente: los que ya estan en Cloudinary se saltan, asi que
    se puede ejecutar mas de una vez sin problema."""
    migrados, ya_en_cloudinary, sin_logo = 0, 0, 0
    async for doc in db.clients.find({}):
        logo = doc.get("logo_url")
        if not logo:
            sin_logo += 1
            continue
        if not _es_logo_base64(logo):
            ya_en_cloudinary += 1
            continue
        url, public_id = await _subir_logo_cloudinary(logo)
        await db.clients.update_one(
            {"id": doc["id"]},
            {
                "$set": {
                    "logo_url": url,
                    "logo_public_id": public_id,
                    "actualizado_en": datetime.now(timezone.utc),
                }
            },
        )
        migrados += 1
    return {"migrados": migrados, "ya_en_cloudinary": ya_en_cloudinary, "sin_logo": sin_logo}


@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, _: dict = Depends(require_admin)):
    """Soft delete: marca activo=False, no borra datos históricos."""
    doc = await db.clients.find_one({"id": client_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"activo": False, "actualizado_en": datetime.now(timezone.utc)}},
    )
    return {"ok": True}


# =====================================================================
# UBICACIONES DE CLIENTE (Fase 6)
# ---------------------------------------------------------------------
# Generico: cualquier cliente puede tener ubicaciones (sedes, estaciones,
# delegaciones...) que requieren visitas periodicas. Nace del caso GALP
# (39 estaciones de servicio con visitas recurrentes que antes se
# llevaban en Excel), pero no esta atado a ese cliente.
#
# FRECUENCIA_OBJETIVO_VISITAS es un mapeo FIJO confirmado sobre datos
# reales del cliente, sin excepciones observadas: no es literal (p.ej.
# "trimestral" son 3 visitas/año, no 4). Se autorellena en el frontend
# al elegir la frecuencia, pero el campo queda editable por si algun
# caso futuro lo necesita distinto.
#
# El calculo de visitas realizadas/pendientes (a partir de las visitas
# reales registradas) llega en la Fase 6 parte 2, junto al calendario.
# =====================================================================

FRECUENCIA_OBJETIVO_VISITAS = {
    "MENSUAL": 8,
    "BIMESTRAL": 4,
    "TRIMESTRAL": 3,
    "SEMESTRAL": 2,
    "ANUAL": 1,
}

_FRECUENCIA_PATTERN = r"^(MENSUAL|BIMESTRAL|TRIMESTRAL|SEMESTRAL|ANUAL)$"
_DIFICULTAD_PATTERN = r"^(facil|media|dificil)$"


class ClientLocationBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    referencia_cliente: Optional[str] = Field(
        None, max_length=50, description="Codigo interno del propio cliente (ej. E0803 en GALP)"
    )
    direccion: Optional[str] = Field("", max_length=300)
    email_contacto: Optional[str] = Field(None, max_length=200)
    enlace_maps: Optional[str] = Field(None, max_length=500)
    horas_por_visita: float = Field(..., ge=0)
    frecuencia: str = Field(..., pattern=_FRECUENCIA_PATTERN)
    visitas_objetivo_ano: int = Field(..., ge=0)
    responsable_id: Optional[str] = None
    dificultad: Optional[str] = Field(None, pattern=_DIFICULTAD_PATTERN)
    notas: Optional[str] = Field("", max_length=2000)


class ClientLocationCreate(ClientLocationBase):
    pass


class ClientLocationUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=200)
    referencia_cliente: Optional[str] = Field(None, max_length=50)
    direccion: Optional[str] = Field(None, max_length=300)
    email_contacto: Optional[str] = Field(None, max_length=200)
    enlace_maps: Optional[str] = Field(None, max_length=500)
    horas_por_visita: Optional[float] = Field(None, ge=0)
    frecuencia: Optional[str] = Field(None, pattern=_FRECUENCIA_PATTERN)
    visitas_objetivo_ano: Optional[int] = Field(None, ge=0)
    responsable_id: Optional[str] = None
    dificultad: Optional[str] = Field(None, pattern=_DIFICULTAD_PATTERN)
    notas: Optional[str] = Field(None, max_length=2000)
    activo: Optional[bool] = None


class ClientLocation(ClientLocationBase):
    id: str
    client_id: str
    client_slug: str
    activo: bool = True
    creado_en: datetime
    actualizado_en: datetime


@api_router.get("/clients/{slug}/locations", response_model=List[ClientLocation])
async def list_client_locations(slug: str, _: dict = Depends(require_approved)):
    """Ubicaciones activas del cliente, por nombre ascendente."""
    slug = _validate_slug(slug)
    cliente = await db.clients.find_one({"slug": slug, "activo": True})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    cursor = db.client_locations.find(
        {"client_id": cliente["id"], "activo": True}
    ).sort("nombre", 1)
    return [ClientLocation(**doc) async for doc in cursor]


@api_router.post("/clients/{slug}/locations", response_model=ClientLocation)
async def create_client_location(
    slug: str, payload: ClientLocationCreate, _: dict = Depends(require_admin)
):
    slug = _validate_slug(slug)
    cliente = await db.clients.find_one({"slug": slug, "activo": True})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "client_id": cliente["id"],
        "client_slug": slug,
        **payload.model_dump(),
        "activo": True,
        "creado_en": now,
        "actualizado_en": now,
    }
    await db.client_locations.insert_one(doc)
    return ClientLocation(**doc)


@api_router.put("/locations/{location_id}", response_model=ClientLocation)
async def update_client_location(
    location_id: str, payload: ClientLocationUpdate, _: dict = Depends(require_admin)
):
    doc = await db.client_locations.find_one({"id": location_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not updates:
        return ClientLocation(**doc)
    if "nombre" in updates and updates["nombre"] is not None:
        updates["nombre"] = updates["nombre"].strip()
    updates["actualizado_en"] = datetime.now(timezone.utc)
    await db.client_locations.update_one({"id": location_id}, {"$set": updates})
    doc = await db.client_locations.find_one({"id": location_id})
    return ClientLocation(**doc)


@api_router.delete("/locations/{location_id}")
async def delete_client_location(location_id: str, _: dict = Depends(require_admin)):
    """Soft delete: marca activo=False, no borra el historial de visitas."""
    doc = await db.client_locations.find_one({"id": location_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")
    await db.client_locations.update_one(
        {"id": location_id},
        {"$set": {"activo": False, "actualizado_en": datetime.now(timezone.utc)}},
    )
    return {"ok": True}



# ---------------------------------------------------------------------
# Presupuestos asociados a un cliente (Fase 4)
# ---------------------------------------------------------------------
# Filtro hibrido: por client_id (nuevos) OR por texto de `cliente`
# case-insensitive contra el nombre del cliente (historicos sin migrar).
# Asi cubrimos ambos casos sin necesidad de migrar la base de datos.

def _budgets_query_for_client(cliente_doc: dict) -> dict:
    """Construye la query MongoDB con el filtro OR cliente_id / texto."""
    nombre = (cliente_doc.get("nombre") or "").strip()
    # Escape de regex para el nombre (por si contiene caracteres especiales)
    safe = re.escape(nombre)
    return {
        "$or": [
            {"client_id": cliente_doc["id"]},
            # ^...$ con anclas + case-insensitive + strip previo
            {"cliente": {"$regex": f"^\\s*{safe}\\s*$", "$options": "i"}},
        ]
    }


@api_router.get("/clients/{slug}/budgets", response_model=List[BudgetTemplate])
async def list_client_budgets(slug: str, _: dict = Depends(require_approved)):
    """Lista de presupuestos asociados al cliente, mas recientes primero."""
    slug = _validate_slug(slug)
    cliente = await db.clients.find_one({"slug": slug, "activo": True})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    query = _budgets_query_for_client(cliente)
    cursor = db.budget_templates.find(query).sort("budget_date", -1)
    return [BudgetTemplate(**doc) async for doc in cursor]


@api_router.get("/clients/{slug}/budgets/summary")
async def client_budgets_summary(slug: str, _: dict = Depends(require_approved)):
    """Totales agregados por cliente en base imponible.

    - total_facturado: suma de total_base de presupuestos con facturado=True
    - total_pendiente: suma de total_base de presupuestos con facturado=False
    - count: numero total de presupuestos asociados
    """
    slug = _validate_slug(slug)
    cliente = await db.clients.find_one({"slug": slug, "activo": True})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    query = _budgets_query_for_client(cliente)
    total_facturado = 0.0
    total_pendiente = 0.0
    count = 0
    async for doc in db.budget_templates.find(query, {"total_base": 1, "facturado": 1}):
        count += 1
        base = float(doc.get("total_base") or 0)
        if doc.get("facturado"):
            total_facturado += base
        else:
            total_pendiente += base
    return {
        "count": count,
        "total_facturado": round(total_facturado, 2),
        "total_pendiente": round(total_pendiente, 2),
    }


# =====================================================================
# CATALOGO DE TAREAS DE TRABAJO (Fase 5A.1)
# ---------------------------------------------------------------------
# Modelo WorkTask + endpoints.
# Las 10 tareas tipicas de jardineria se autosiembran al arrancar
# si la coleccion esta vacia (ver seed_work_tasks_if_empty).
#
# El campo `en_top10` marca las tareas que aparecen como checkbox
# rapido en el formulario de sesion. El resto quedan disponibles
# en un buscador/desplegable. La propiedad es editable por admin
# y facturacion desde la pagina /admin/work-tasks.
#
# Cualquier usuario aprobado puede crear tareas al vuelo desde el
# formulario del parte. Solo admin+facturacion pueden editar o
# borrar tareas existentes (para no ensuciar el catalogo).
# =====================================================================


class WorkTaskBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=80)
    en_top10: bool = False
    orden: int = 100


class WorkTaskCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=80)
    # en_top10 y orden solo pueden asignarse en creacion por admin/facturacion.
    # Un usuario normal creando al vuelo solo indica el nombre.
    en_top10: Optional[bool] = False
    orden: Optional[int] = 100


class WorkTaskUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=80)
    en_top10: Optional[bool] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None


class WorkTask(WorkTaskBase):
    id: str
    activo: bool = True
    uso_count: int = 0
    creado_en: datetime


# Tareas iniciales tipicas de jardineria. Las 10 estan marcadas como top10.
_SEED_WORK_TASKS = [
    {"nombre": "Poda", "orden": 10, "en_top10": True},
    {"nombre": "Siega", "orden": 20, "en_top10": True},
    {"nombre": "Desbroce", "orden": 30, "en_top10": True},
    {"nombre": "Riego", "orden": 40, "en_top10": True},
    {"nombre": "Abonado", "orden": 50, "en_top10": True},
    {"nombre": "Tratamiento fitosanitario", "orden": 60, "en_top10": True},
    {"nombre": "Limpieza", "orden": 70, "en_top10": True},
    {"nombre": "Recogida de restos", "orden": 80, "en_top10": True},
    {"nombre": "Plantacion", "orden": 90, "en_top10": True},
    {"nombre": "Trasplante", "orden": 100, "en_top10": True},
]


async def seed_work_tasks_if_empty() -> None:
    """Inserta las 10 tareas iniciales si la coleccion esta vacia. Idempotente."""
    count = await db.work_tasks.count_documents({})
    if count > 0:
        return
    now = datetime.now(timezone.utc)
    docs = [
        {
            "id": str(uuid.uuid4()),
            "nombre": t["nombre"],
            "orden": t["orden"],
            "en_top10": t["en_top10"],
            "activo": True,
            "uso_count": 0,
            "creado_en": now,
        }
        for t in _SEED_WORK_TASKS
    ]
    await db.work_tasks.insert_many(docs)


@api_router.get("/work-tasks", response_model=List[WorkTask])
async def list_work_tasks(_: dict = Depends(require_approved)):
    """Catalogo de tareas activas, orden ascendente por 'orden' y luego nombre."""
    cursor = db.work_tasks.find({"activo": True}).sort([("orden", 1), ("nombre", 1)])
    return [WorkTask(**doc) async for doc in cursor]


@api_router.post("/work-tasks", response_model=WorkTask)
async def create_work_task(
    payload: WorkTaskCreate, current_user: dict = Depends(require_approved)
):
    """Crea una tarea nueva. Cualquier usuario aprobado puede crearla al vuelo.

    Si el usuario NO es admin/facturacion, se ignora `en_top10` y `orden`
    para evitar que un operario ensucie el catalogo desde el formulario.
    """
    nombre = payload.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre obligatorio")
    # Comprobar duplicado case-insensitive
    existing = await db.work_tasks.find_one(
        {"nombre": {"$regex": f"^{re.escape(nombre)}$", "$options": "i"}}
    )
    if existing:
        # Devolvemos la existente (idempotente): si la reactivamos si estaba inactiva
        if not existing.get("activo", True):
            await db.work_tasks.update_one(
                {"id": existing["id"]}, {"$set": {"activo": True}}
            )
            existing = await db.work_tasks.find_one({"id": existing["id"]})
        return WorkTask(**existing)

    is_admin_like = current_user.get("role") in ("admin", "facturacion")
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "nombre": nombre,
        "orden": (payload.orden if is_admin_like and payload.orden is not None else 100),
        "en_top10": (bool(payload.en_top10) if is_admin_like else False),
        "activo": True,
        "uso_count": 0,
        "creado_en": now,
    }
    await db.work_tasks.insert_one(doc)
    return WorkTask(**doc)


@api_router.patch("/work-tasks/{task_id}", response_model=WorkTask)
async def update_work_task(
    task_id: str, payload: WorkTaskUpdate, _: dict = Depends(require_admin)
):
    """Editar tarea o mover en/fuera del top10 (solo admin).

    Nota: la restriccion admin+facturacion se aplicara desde el frontend
    si en el futuro se decide relajar. De momento solo admin para evitar
    conflictos con el catalogo.
    """
    doc = await db.work_tasks.find_one({"id": task_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not updates:
        return WorkTask(**doc)
    if "nombre" in updates and updates["nombre"] is not None:
        updates["nombre"] = updates["nombre"].strip()
        if not updates["nombre"]:
            raise HTTPException(status_code=400, detail="Nombre no puede estar vacio")
        # Duplicado con otra tarea distinta
        dup = await db.work_tasks.find_one(
            {
                "nombre": {"$regex": f"^{re.escape(updates['nombre'])}$", "$options": "i"},
                "id": {"$ne": task_id},
            }
        )
        if dup:
            raise HTTPException(status_code=409, detail="Ya existe una tarea con ese nombre")
    await db.work_tasks.update_one({"id": task_id}, {"$set": updates})
    doc = await db.work_tasks.find_one({"id": task_id})
    return WorkTask(**doc)


@api_router.delete("/work-tasks/{task_id}")
async def delete_work_task(task_id: str, _: dict = Depends(require_admin)):
    """Soft delete: marca activo=False. Los partes que la usaron conservan la referencia."""
    doc = await db.work_tasks.find_one({"id": task_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    await db.work_tasks.update_one({"id": task_id}, {"$set": {"activo": False}})
    return {"ok": True}

# =====================================================================
# OPERARIOS (Fase 5A.2 parte 2)
# ---------------------------------------------------------------------
# Endpoint ligero para poblar el desplegable de operarios registrados
# en el modal de sesion. Deliberadamente NO reutiliza /admin/users
# (protegido por require_admin): cualquier operario aprobado necesita
# poder ver a sus companeros para rellenar un parte, no solo el admin.
# Expone solo lo imprescindible (id, nombre, email) - nunca password_hash
# ni otros campos sensibles.
# =====================================================================


@api_router.get("/users/operarios")
async def list_operarios(_: dict = Depends(require_approved)):
    """Usuarios con rol 'user' y estado 'approved', para selects de operarios."""
    cursor = db.users.find(
        {"role": UserRole.USER, "status": UserStatus.APPROVED},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1},
    ).sort("name", 1)
    return await cursor.to_list(1000)


# =====================================================================
# PARTES DE TRABAJO (Fase 5A.2 parte 1)
# ---------------------------------------------------------------------
# Modelos WorkOrder + WorkSession con endpoints REST completos.
#
# Un WorkOrder es la cabecera del parte asociado a un cliente y
# opcionalmente a un presupuesto. Puede tener multiples sesiones
# diarias (WorkSession). Las firmas se anadiran en Fase 5A.3.
#
# Denormalizacion consciente:
# - En work_orders guardamos client_slug y budget_number para no
#   tener que hacer joins costosos en cada listado. Si el cliente
#   se renombra, ejecutar un script de recalculo (Fase futura).
# - Las sesiones NO estan embebidas en el work_order: coleccion
#   separada work_sessions con work_order_id como referencia. Esto
#   permite que un parte con muchos dias no crezca sin limite en
#   un solo documento (limite Mongo: 16MB por documento).
#
# Permisos:
# - Lectura y creacion de partes/sesiones: cualquier usuario aprobado
#   (los operarios registran su trabajo).
# - Modificar/borrar parte cerrado: solo admin (via reopen en 5A.3).
# - Modificar parte propio abierto: cualquier aprobado.
# =====================================================================


ESTADOS_WORK_ORDER = ("abierto", "cerrado", "archivado")


class WorkOrderBase(BaseModel):
    client_id: str = Field(..., description="ID del cliente al que pertenece el parte")
    budget_template_id: Optional[str] = Field(None, description="Presupuesto asociado (opcional)")
    titulo: str = Field(..., min_length=1, max_length=200)
    notas: Optional[str] = Field("", max_length=4000)


class WorkOrderCreate(WorkOrderBase):
    pass


class WorkOrderUpdate(BaseModel):
    titulo: Optional[str] = Field(None, min_length=1, max_length=200)
    notas: Optional[str] = Field(None, max_length=4000)
    budget_template_id: Optional[str] = None
    estado: Optional[str] = None  # solo admin puede cambiar a archivado, se valida en handler


class WorkOrder(WorkOrderBase):
    id: str
    client_slug: str
    budget_number: Optional[str] = None
    estado: str = "abierto"
    creado_por: str
    creado_en: datetime
    actualizado_en: datetime
    cerrado_en: Optional[datetime] = None
    firma_cliente_token: Optional[str] = Field(
        None, description="Token del enlace publico de firma (Fase 5A.3 parte 2)."
    )
    firma_cliente: Optional[str] = Field(
        None, max_length=270000, description="PNG en base64 (data URL) de la firma del cliente."
    )
    firma_cliente_nombre: Optional[str] = None
    firma_cliente_en: Optional[datetime] = None


class WorkSessionBase(BaseModel):
    fecha: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    hora_inicio: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    hora_fin: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    operarios_ids: List[str] = Field(default_factory=list)
    operarios_texto_libre: Optional[str] = Field("", max_length=500)
    firmante_responsable_id: Optional[str] = None
    firmante_responsable_texto: Optional[str] = Field("", max_length=200)
    tareas_ids: List[str] = Field(default_factory=list)
    tareas_libres: List[str] = Field(default_factory=list)
    notas: Optional[str] = Field("", max_length=2000)
    visibilidad: Dict[str, bool] = Field(
        default_factory=dict,
        description="Toggles de visibilidad al cliente por campo (Fase 5A.3). Claves: operarios, horas, tareas, notas. Si una clave no esta presente se considera visible.",
    )
    firma_responsable: Optional[str] = Field(
        None,
        max_length=270000,
        description="PNG en base64 (data URL) de la firma del operario responsable, capturada en el propio parte.",
    )


class WorkSessionCreate(WorkSessionBase):
    pass


class WorkSessionUpdate(BaseModel):
    fecha: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    hora_inicio: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    hora_fin: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    operarios_ids: Optional[List[str]] = None
    operarios_texto_libre: Optional[str] = None
    firmante_responsable_id: Optional[str] = None
    firmante_responsable_texto: Optional[str] = None
    tareas_ids: Optional[List[str]] = None
    tareas_libres: Optional[List[str]] = None
    notas: Optional[str] = None
    visibilidad: Optional[Dict[str, bool]] = None
    firma_responsable: Optional[str] = Field(None, max_length=270000)


class WorkSession(WorkSessionBase):
    id: str
    work_order_id: str
    creado_por: str
    creado_en: datetime
    actualizado_en: datetime
    firma_responsable_en: Optional[datetime] = None


class WorkOrderWithSessions(WorkOrder):
    sessions: List[WorkSession] = Field(default_factory=list)


class SesionPublica(BaseModel):
    """Vista de una sesion tal como la ve el cliente, ya filtrada por visibilidad."""

    fecha: str
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    operarios: Optional[List[str]] = None
    tareas: Optional[List[str]] = None
    notas: Optional[str] = None
    firmante: Optional[str] = None
    firma_responsable: Optional[str] = None


class WorkOrderPublicView(BaseModel):
    """Lo minimo necesario para que el cliente revise y firme, sin exponer
    IDs internos, datos de otros clientes ni el propio token."""

    titulo: str
    cliente_nombre: str
    estado: str
    creado_en: datetime
    sessions: List[SesionPublica]
    firma_cliente: Optional[str] = None
    firma_cliente_nombre: Optional[str] = None
    firma_cliente_en: Optional[datetime] = None


class FirmaClientePayload(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    firma: str = Field(..., max_length=270000)


def _horas_de_sesion(hora_inicio: str, hora_fin: str) -> float:
    """Duracion en horas de una sesion. Devuelve 0 si algo raro."""
    try:
        h1, m1 = map(int, hora_inicio.split(":"))
        h2, m2 = map(int, hora_fin.split(":"))
        minutos = (h2 * 60 + m2) - (h1 * 60 + m1)
        if minutos <= 0:
            return 0.0
        return round(minutos / 60.0, 2)
    except (ValueError, AttributeError):
        return 0.0


async def _cargar_cliente_por_id(client_id: str) -> dict:
    doc = await db.clients.find_one({"id": client_id, "activo": True})
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return doc


async def _cargar_parte(work_order_id: str) -> dict:
    doc = await db.work_orders.find_one({"id": work_order_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Parte no encontrado")
    return doc


@api_router.get("/work-orders", response_model=List[WorkOrder])
async def list_work_orders(
    client_id: Optional[str] = None,
    estado: Optional[str] = None,
    _: dict = Depends(require_approved),
):
    """Lista de partes con filtros opcionales."""
    query = {}
    if client_id:
        query["client_id"] = client_id
    if estado:
        if estado not in ESTADOS_WORK_ORDER:
            raise HTTPException(status_code=400, detail="Estado invalido")
        query["estado"] = estado
    cursor = db.work_orders.find(query).sort("creado_en", -1)
    return [WorkOrder(**doc) async for doc in cursor]


@api_router.get("/work-orders/{work_order_id}", response_model=WorkOrderWithSessions)
async def get_work_order(work_order_id: str, _: dict = Depends(require_approved)):
    """Detalle del parte incluyendo todas sus sesiones ordenadas por fecha."""
    doc = await _cargar_parte(work_order_id)
    sessions_cursor = db.work_sessions.find({"work_order_id": work_order_id}).sort(
        [("fecha", 1), ("hora_inicio", 1)]
    )
    sessions = [WorkSession(**s) async for s in sessions_cursor]
    return WorkOrderWithSessions(**doc, sessions=sessions)


@api_router.post("/work-orders", response_model=WorkOrder)
async def create_work_order(
    payload: WorkOrderCreate, current_user: dict = Depends(require_approved)
):
    """Crea la cabecera de un parte. Valida cliente (obligatorio) y presupuesto (opcional)."""
    cliente = await _cargar_cliente_por_id(payload.client_id)

    budget_number = None
    if payload.budget_template_id:
        bud = await db.budget_templates.find_one({"id": payload.budget_template_id})
        if not bud:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
        budget_number = bud.get("budget_number")

    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "client_id": cliente["id"],
        "client_slug": cliente["slug"],
        "budget_template_id": payload.budget_template_id,
        "budget_number": budget_number,
        "titulo": payload.titulo.strip(),
        "notas": (payload.notas or "").strip(),
        "estado": "abierto",
        "creado_por": current_user.get("id") or current_user.get("email") or "?",
        "creado_en": now,
        "actualizado_en": now,
        "cerrado_en": None,
    }
    await db.work_orders.insert_one(doc)
    return WorkOrder(**doc)


@api_router.patch("/work-orders/{work_order_id}", response_model=WorkOrder)
async def update_work_order(
    work_order_id: str,
    payload: WorkOrderUpdate,
    current_user: dict = Depends(require_approved),
):
    """Editar cabecera. Si esta cerrado solo admin puede tocar."""
    doc = await _cargar_parte(work_order_id)
    if doc["estado"] == "cerrado" and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="El parte esta cerrado")

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not updates:
        return WorkOrder(**doc)

    if "titulo" in updates and updates["titulo"] is not None:
        updates["titulo"] = updates["titulo"].strip()
    if "notas" in updates and updates["notas"] is not None:
        updates["notas"] = updates["notas"].strip()

    if "budget_template_id" in updates:
        if updates["budget_template_id"]:
            bud = await db.budget_templates.find_one({"id": updates["budget_template_id"]})
            if not bud:
                raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
            updates["budget_number"] = bud.get("budget_number")
        else:
            updates["budget_number"] = None

    if "estado" in updates:
        if updates["estado"] not in ESTADOS_WORK_ORDER:
            raise HTTPException(status_code=400, detail="Estado invalido")
        # Solo admin puede archivar; cerrar sera via /close en 5A.3
        if updates["estado"] == "archivado" and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Solo admin puede archivar")

    updates["actualizado_en"] = datetime.now(timezone.utc)
    await db.work_orders.update_one({"id": work_order_id}, {"$set": updates})
    doc = await _cargar_parte(work_order_id)
    return WorkOrder(**doc)


@api_router.delete("/work-orders/{work_order_id}")
async def delete_work_order(
    work_order_id: str, current_user: dict = Depends(require_approved)
):
    """Borrar solo si abierto y sin sesiones. Es hard delete: un parte
    sin datos no aporta nada. Los partes cerrados nunca se borran."""
    doc = await _cargar_parte(work_order_id)
    if doc["estado"] != "abierto":
        raise HTTPException(status_code=403, detail="Solo se pueden borrar partes abiertos")
    count = await db.work_sessions.count_documents({"work_order_id": work_order_id})
    if count > 0:
        raise HTTPException(status_code=400, detail="El parte tiene sesiones registradas")
    await db.work_orders.delete_one({"id": work_order_id})
    return {"ok": True}


@api_router.post("/work-orders/{work_order_id}/generar-enlace-firma")
async def generar_enlace_firma(
    work_order_id: str, current_user: dict = Depends(require_approved)
):
    """Genera (una sola vez) el token del enlace publico de firma del cliente.
    Si ya existe, se devuelve el mismo para no invalidar enlaces ya compartidos."""
    doc = await _cargar_parte(work_order_id)
    token = doc.get("firma_cliente_token")
    if not token:
        token = secrets.token_urlsafe(32)
        await db.work_orders.update_one(
            {"id": work_order_id}, {"$set": {"firma_cliente_token": token}}
        )
    return {"token": token}


async def _construir_vista_publica(doc: dict) -> WorkOrderPublicView:
    """Arma la vista publica de un parte: resuelve nombres de operarios/tareas
    y filtra cada sesion segun su campo visibilidad."""
    cliente = await db.clients.find_one({"id": doc["client_id"]})
    sessions_cursor = db.work_sessions.find({"work_order_id": doc["id"]}).sort(
        [("fecha", 1), ("hora_inicio", 1)]
    )
    sessions = [s async for s in sessions_cursor]

    operario_ids, tarea_ids = set(), set()
    for s in sessions:
        operario_ids.update(s.get("operarios_ids", []))
        tarea_ids.update(s.get("tareas_ids", []))
        if s.get("firmante_responsable_id"):
            operario_ids.add(s["firmante_responsable_id"])

    operarios_map = {}
    if operario_ids:
        async for u in db.users.find(
            {"user_id": {"$in": list(operario_ids)}}, {"_id": 0, "user_id": 1, "name": 1}
        ):
            operarios_map[u["user_id"]] = u["name"]

    tareas_map = {}
    if tarea_ids:
        async for t in db.work_tasks.find(
            {"id": {"$in": list(tarea_ids)}}, {"_id": 0, "id": 1, "nombre": 1}
        ):
            tareas_map[t["id"]] = t["nombre"]

    sessions_publicas = []
    for s in sessions:
        vis = s.get("visibilidad") or {}
        item = {"fecha": s["fecha"]}

        if vis.get("horas", True):
            item["hora_inicio"] = s["hora_inicio"]
            item["hora_fin"] = s["hora_fin"]

        if vis.get("operarios", True):
            nombres = [operarios_map.get(uid, "Operario") for uid in s.get("operarios_ids", [])]
            libres = s.get("operarios_texto_libre") or ""
            nombres += [n.strip() for n in libres.split(",") if n.strip()]
            item["operarios"] = nombres

        if vis.get("tareas", True):
            item["tareas"] = [
                tareas_map[tid] for tid in s.get("tareas_ids", []) if tid in tareas_map
            ]

        if vis.get("notas", True) and s.get("notas"):
            item["notas"] = s["notas"]

        if s.get("firmante_responsable_id"):
            item["firmante"] = operarios_map.get(s["firmante_responsable_id"], "Operario")
        elif s.get("firmante_responsable_texto"):
            item["firmante"] = s["firmante_responsable_texto"]

        if s.get("firma_responsable"):
            item["firma_responsable"] = s["firma_responsable"]

        sessions_publicas.append(SesionPublica(**item))

    return WorkOrderPublicView(
        titulo=doc["titulo"],
        cliente_nombre=cliente["nombre"] if cliente else "",
        estado=doc["estado"],
        creado_en=doc["creado_en"],
        sessions=sessions_publicas,
        firma_cliente=doc.get("firma_cliente"),
        firma_cliente_nombre=doc.get("firma_cliente_nombre"),
        firma_cliente_en=doc.get("firma_cliente_en"),
    )


# --- Enlace publico de firma (Fase 5A.3 parte 2) ---------------------------
# Sin autenticacion a proposito: el cliente accede via un token largo e
# impredecible (secrets.token_urlsafe), no via login. No se expone aqui
# ningun ID interno, dato de otros clientes, ni el propio token.


@api_router.get("/public/firma/{token}", response_model=WorkOrderPublicView)
async def ver_parte_publico(token: str):
    doc = await db.work_orders.find_one({"firma_cliente_token": token})
    if not doc:
        raise HTTPException(status_code=404, detail="Enlace no valido")
    return await _construir_vista_publica(doc)


@api_router.post("/public/firma/{token}")
async def firmar_parte_publico(token: str, payload: FirmaClientePayload):
    doc = await db.work_orders.find_one({"firma_cliente_token": token})
    if not doc:
        raise HTTPException(status_code=404, detail="Enlace no valido")
    await db.work_orders.update_one(
        {"id": doc["id"]},
        {
            "$set": {
                "firma_cliente": payload.firma,
                "firma_cliente_nombre": payload.nombre.strip(),
                "firma_cliente_en": datetime.now(timezone.utc),
            }
        },
    )
    return {"ok": True}


# --- PDF del parte (Fase 5A.3 parte 2b) -------------------------------------
# Reutiliza _construir_vista_publica: mismo contenido y misma logica de
# visibilidad que ve el cliente en el enlace publico, asi que nunca pueden
# desincronizarse. Todo texto dinamico pasa por _p() (escape XML) porque
# reportlab interpreta Paragraph como markup; sin escapar, un nombre o nota
# con "&", "<" o ">" rompe la generacion del PDF.

_MESES_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _p(texto: Optional[str]) -> str:
    return xml_escape(texto or "")


def _formatear_fecha_es(fecha_str: str) -> str:
    try:
        d = datetime.strptime(fecha_str, "%Y-%m-%d")
        return f"{d.day} de {_MESES_ES[d.month - 1]} de {d.year}"
    except (ValueError, TypeError):
        return fecha_str


def _decode_firma_pdf(data_url: Optional[str], max_width_cm: float = 6.0):
    if not data_url:
        return None
    try:
        b64 = data_url.split(",", 1)[1] if "," in data_url else data_url
        raw = base64.b64decode(b64)
        img = RLImage(io.BytesIO(raw))
        max_w = max_width_cm * cm
        if img.drawWidth > max_w:
            ratio = max_w / img.drawWidth
            img.drawWidth = max_w
            img.drawHeight = img.drawHeight * ratio
        return img
    except Exception:
        logger.warning("No se pudo decodificar una firma para el PDF", exc_info=True)
        return None


def _generar_pdf_parte(vista: WorkOrderPublicView) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        title=vista.titulo,
    )
    styles = getSampleStyleSheet()
    titulo_style = ParagraphStyle(
        "TituloParte", parent=styles["Heading1"], fontSize=16, spaceAfter=4
    )
    subtitulo_style = ParagraphStyle(
        "Subtitulo", parent=styles["Normal"], fontSize=10,
        textColor=colors.HexColor("#64748b"), spaceAfter=12,
    )
    sesion_titulo_style = ParagraphStyle(
        "SesionTitulo", parent=styles["Heading3"], fontSize=12,
        spaceBefore=10, spaceAfter=4,
    )
    normal_style = ParagraphStyle(
        "NormalP", parent=styles["Normal"], fontSize=9.5, leading=13
    )
    etiqueta_style = ParagraphStyle(
        "Etiqueta", parent=styles["Normal"], fontSize=8,
        textColor=colors.HexColor("#94a3b8"), spaceAfter=4,
    )

    story = [
        Paragraph(_p(vista.titulo), titulo_style),
        Paragraph(
            f"{_p(vista.cliente_nombre)} &nbsp;&middot;&nbsp; Estado: {_p(vista.estado)}",
            subtitulo_style,
        ),
        HRFlowable(width="100%", color=colors.HexColor("#e2e8f0"), thickness=1),
        Spacer(1, 12),
    ]

    if not vista.sessions:
        story.append(Paragraph("Todavia no hay sesiones registradas en este parte.", normal_style))

    for s in vista.sessions:
        titulo_sesion = _formatear_fecha_es(s.fecha)
        if s.hora_inicio and s.hora_fin:
            titulo_sesion += f"  &nbsp;&nbsp;  {s.hora_inicio} - {s.hora_fin}"
        story.append(Paragraph(titulo_sesion, sesion_titulo_style))

        if s.operarios:
            story.append(Paragraph(f"<b>Operarios:</b> {_p(', '.join(s.operarios))}", normal_style))
        if s.tareas:
            story.append(Paragraph(f"<b>Tareas:</b> {_p(', '.join(s.tareas))}", normal_style))
        if s.notas:
            story.append(Paragraph(f"<b>Notas:</b> {_p(s.notas)}", normal_style))

        if s.firmante:
            story.append(Spacer(1, 6))
            story.append(Paragraph(f"Responsable de la jornada: {_p(s.firmante)}", etiqueta_style))
        firma_img = _decode_firma_pdf(s.firma_responsable, max_width_cm=4.5)
        if firma_img:
            story.append(firma_img)

        story.append(Spacer(1, 8))
        story.append(HRFlowable(width="100%", color=colors.HexColor("#f1f5f9"), thickness=0.5))
        story.append(Spacer(1, 4))

    story.append(Spacer(1, 16))
    story.append(Paragraph("Firma del cliente", sesion_titulo_style))
    if vista.firma_cliente:
        fecha_txt = (
            vista.firma_cliente_en.strftime("%d/%m/%Y %H:%M") if vista.firma_cliente_en else ""
        )
        story.append(
            Paragraph(f"Firmado por {_p(vista.firma_cliente_nombre)} el {fecha_txt}", etiqueta_style)
        )
        firma_img = _decode_firma_pdf(vista.firma_cliente, max_width_cm=6.0)
        if firma_img:
            story.append(firma_img)
    else:
        story.append(Paragraph("Pendiente de firma.", normal_style))

    doc.build(story)
    return buffer.getvalue()


@api_router.get("/work-orders/{work_order_id}/pdf")
async def descargar_pdf_parte(
    work_order_id: str, _: dict = Depends(require_approved)
):
    doc = await _cargar_parte(work_order_id)
    vista = await _construir_vista_publica(doc)
    pdf_bytes = _generar_pdf_parte(vista)
    filename = f"parte-{doc['id'][:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --- Sesiones -------------------------------------------------------------


@api_router.post("/work-orders/{work_order_id}/sessions", response_model=WorkSession)
async def create_session(
    work_order_id: str,
    payload: WorkSessionCreate,
    current_user: dict = Depends(require_approved),
):
    """Anadir una sesion diaria al parte. Solo si el parte esta abierto."""
    doc = await _cargar_parte(work_order_id)
    if doc["estado"] != "abierto":
        raise HTTPException(status_code=403, detail="El parte no esta abierto")

    now = datetime.now(timezone.utc)
    session_doc = {
        "id": str(uuid.uuid4()),
        "work_order_id": work_order_id,
        **payload.model_dump(),
        "creado_por": current_user.get("id") or current_user.get("email") or "?",
        "creado_en": now,
        "actualizado_en": now,
        "firma_responsable_en": now if payload.firma_responsable else None,
    }
    await db.work_sessions.insert_one(session_doc)
    await db.work_orders.update_one(
        {"id": work_order_id}, {"$set": {"actualizado_en": now}}
    )
    return WorkSession(**session_doc)


@api_router.patch(
    "/work-orders/{work_order_id}/sessions/{session_id}", response_model=WorkSession
)
async def update_session(
    work_order_id: str,
    session_id: str,
    payload: WorkSessionUpdate,
    current_user: dict = Depends(require_approved),
):
    doc = await _cargar_parte(work_order_id)
    if doc["estado"] != "abierto" and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="El parte no esta abierto")
    session_doc = await db.work_sessions.find_one(
        {"id": session_id, "work_order_id": work_order_id}
    )
    if not session_doc:
        raise HTTPException(status_code=404, detail="Sesion no encontrada")

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not updates:
        return WorkSession(**session_doc)
    if "firma_responsable" in updates:
        updates["firma_responsable_en"] = (
            datetime.now(timezone.utc) if updates["firma_responsable"] else None
        )
    updates["actualizado_en"] = datetime.now(timezone.utc)
    await db.work_sessions.update_one({"id": session_id}, {"$set": updates})
    await db.work_orders.update_one(
        {"id": work_order_id}, {"$set": {"actualizado_en": updates["actualizado_en"]}}
    )
    session_doc = await db.work_sessions.find_one({"id": session_id})
    return WorkSession(**session_doc)


@api_router.delete("/work-orders/{work_order_id}/sessions/{session_id}")
async def delete_session(
    work_order_id: str,
    session_id: str,
    current_user: dict = Depends(require_approved),
):
    doc = await _cargar_parte(work_order_id)
    if doc["estado"] != "abierto" and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="El parte no esta abierto")
    result = await db.work_sessions.delete_one(
        {"id": session_id, "work_order_id": work_order_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sesion no encontrada")
    await db.work_orders.update_one(
        {"id": work_order_id}, {"$set": {"actualizado_en": datetime.now(timezone.utc)}}
    )
    return {"ok": True}


# --- Endpoints ficha del cliente ------------------------------------------


@api_router.get(
    "/clients/{slug}/work-orders", response_model=List[WorkOrder]
)
async def list_client_work_orders(slug: str, _: dict = Depends(require_approved)):
    """Lista de partes del cliente, mas recientes primero."""
    slug = _validate_slug(slug)
    cliente = await db.clients.find_one({"slug": slug, "activo": True})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    cursor = db.work_orders.find({"client_id": cliente["id"]}).sort("creado_en", -1)
    return [WorkOrder(**doc) async for doc in cursor]


@api_router.get("/clients/{slug}/work-orders/summary")
async def client_work_orders_summary(slug: str, _: dict = Depends(require_approved)):
    """Totales del cliente: contador por estado + horas acumuladas."""
    slug = _validate_slug(slug)
    cliente = await db.clients.find_one({"slug": slug, "activo": True})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    counters = {"abierto": 0, "cerrado": 0, "archivado": 0}
    ids_por_estado: dict = {"abierto": [], "cerrado": [], "archivado": []}
    async for doc in db.work_orders.find(
        {"client_id": cliente["id"]}, {"id": 1, "estado": 1}
    ):
        estado = doc.get("estado", "abierto")
        if estado in counters:
            counters[estado] += 1
            ids_por_estado[estado].append(doc["id"])

    todos_ids = ids_por_estado["abierto"] + ids_por_estado["cerrado"] + ids_por_estado["archivado"]
    total_horas = 0.0
    if todos_ids:
        async for s in db.work_sessions.find(
            {"work_order_id": {"$in": todos_ids}},
            {"hora_inicio": 1, "hora_fin": 1},
        ):
            total_horas += _horas_de_sesion(
                s.get("hora_inicio", ""), s.get("hora_fin", "")
            )

    return {
        "total": sum(counters.values()),
        "abiertos": counters["abierto"],
        "cerrados": counters["cerrado"],
        "archivados": counters["archivado"],
        "total_horas": round(total_horas, 2),
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def on_startup():
    # Auto-siembra de datos base al arrancar (idempotente).
    await seed_clients_if_empty()
    await seed_work_tasks_if_empty()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
