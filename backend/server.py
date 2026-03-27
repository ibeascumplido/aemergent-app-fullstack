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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============ USER ROLE ENUM ============
class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"

class UserStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

# ============ VACATION REQUEST STATUS ============
class VacationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

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
        await db.users.insert_one(user)
    
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
    await db.users.insert_one(user)
    
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
    await db.vacaciones.insert_one(vacacion)
    
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
    
    await db.vacaciones.update_one(
        {"id": vacacion_id},
        {"$set": {
            "status": VacationStatus.APPROVED,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": admin["user_id"]
        }}
    )
    
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
    
    await db.vacaciones.update_one(
        {"id": vacacion_id},
        {"$set": {
            "status": VacationStatus.REJECTED,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": admin["user_id"],
            "rejection_comment": comment
        }}
    )
    
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
        # Count vacaciones for this year
        vacaciones_count = await db.vacaciones.count_documents({
            "user_id": user["user_id"],
            "fecha": {"$regex": f"^{year}"},
            "tipo": "vacacion"
        })
        # Count dias libres for this year
        libres_count = await db.vacaciones.count_documents({
            "user_id": user["user_id"],
            "fecha": {"$regex": f"^{year}"},
            "tipo": "libre"
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
            "dias_disfrutados": vacaciones_count,
            "dias_restantes": dias_vacaciones_disponibles - vacaciones_count,
            # Días libres
            "dias_libres_disponibles": dias_libres_disponibles,
            "dias_libres_disfrutados": libres_count,
            "dias_libres_restantes": dias_libres_disponibles - libres_count,
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
