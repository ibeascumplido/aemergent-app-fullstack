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

# ============ VACACIONES ENDPOINTS ============

@api_router.get("/vacaciones")
async def get_vacaciones(month: Optional[str] = None):
    query = {}
    if month:
        query["fecha"] = {"$regex": f"^{month}"}
    vacaciones = await db.vacaciones.find(query, {"_id": 0}).to_list(10000)
    return vacaciones

@api_router.post("/vacaciones", response_model=Vacacion)
async def create_vacacion(vacacion_data: VacacionCreate):
    # Check if already exists
    existing = await db.vacaciones.find_one({
        "operario_id": vacacion_data.operario_id,
        "fecha": vacacion_data.fecha
    }, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Vacation already exists for this day")
    
    vacacion = Vacacion(**vacacion_data.model_dump())
    doc = vacacion.model_dump()
    await db.vacaciones.insert_one(doc)
    return vacacion

@api_router.delete("/vacaciones/{operario_id}/{fecha}")
async def delete_vacacion(operario_id: str, fecha: str):
    result = await db.vacaciones.delete_one({"operario_id": operario_id, "fecha": fecha})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vacation not found")
    return {"message": "Vacation deleted successfully"}

@api_router.get("/vacaciones/resumen")
async def get_vacaciones_resumen(year: Optional[int] = None):
    if not year:
        year = datetime.now().year
    
    # Get all operarios
    operarios = await db.operarios.find({}, {"_id": 0}).sort("orden", 1).to_list(100)
    
    resumen = []
    for op in operarios:
        # Count vacaciones for this year
        vacaciones_count = await db.vacaciones.count_documents({
            "operario_id": op["id"],
            "fecha": {"$regex": f"^{year}"},
            "tipo": "vacacion"
        })
        # Count dias libres for this year
        libres_count = await db.vacaciones.count_documents({
            "operario_id": op["id"],
            "fecha": {"$regex": f"^{year}"},
            "tipo": "libre"
        })
        
        # Días de vacaciones
        dias_vacaciones_disponibles = op.get("dias_vacaciones", 22)
        # Días libres (mismo tratamiento que vacaciones)
        dias_libres_disponibles = op.get("dias_libres", 6)
        
        resumen.append({
            "operario_id": op["id"],
            "nombre": op["nombre"],
            "abreviatura": op["abreviatura"],
            "color": op["color"],
            # Vacaciones
            "dias_disponibles": dias_vacaciones_disponibles,
            "dias_disfrutados": vacaciones_count,
            "dias_restantes": dias_vacaciones_disponibles - vacaciones_count,
            # Días libres (con contadores completos)
            "dias_libres_disponibles": dias_libres_disponibles,
            "dias_libres_disfrutados": libres_count,
            "dias_libres_restantes": dias_libres_disponibles - libres_count,
        })
    
    return resumen

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
