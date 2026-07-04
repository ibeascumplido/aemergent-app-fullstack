from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
import hashlib
import httpx
import asyncio
import resend

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Resend configuration
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

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
# NOTA DE ARQUITECTURA (logo):
# En esta fase el logo se guarda como data-URI base64 dentro del propio
# documento (campo logo_url). Es aceptable para logos pequeños (<200KB).
# Cuando lleguen las fotografías de cliente (Fase 6) se migrará a un
# servicio externo tipo Cloudinary/S3, porque MongoDB no debe usarse
# como almacén de binarios grandes ni de volumen.
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
    logo_url: Optional[str] = Field(None, description="Data-URI base64 o URL externa")
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
    doc = {
        "id": str(uuid.uuid4()),
        "slug": slug,
        "nombre": payload.nombre.strip(),
        "logo_url": payload.logo_url,
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
    updates["actualizado_en"] = datetime.now(timezone.utc)
    await db.clients.update_one({"id": client_id}, {"$set": updates})
    doc = await db.clients.find_one({"id": client_id})
    return Client(**doc)


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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
