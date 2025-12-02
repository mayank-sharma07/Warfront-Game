from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
import random
import jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "warfront-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI(title="Warfront API")


# CORS middleware must be added BEFORE routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://192.168.1.3:3000",
        "*",   # allow everything for now (you can remove later)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class Unit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str  # infantry, tank, artillery, aircraft
    attack: int
    defense: int
    health: int
    cost: int

class Army(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_id: str
    player_name: str
    units: List[Unit]
    total_power: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ArmyCreate(BaseModel):
    player_name: str
    units: List[Unit]

class Battle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    army1_id: str
    army2_id: str
    army1_name: str
    army2_name: str
    winner_id: str
    winner_name: str
    battle_log: List[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BattleRequest(BaseModel):
    army1_id: str
    army2_id: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    password: str  # hashed password
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Player(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    wins: int = 0
    losses: int = 0
    total_battles: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PlayerCreate(BaseModel):
    name: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

# Helper Functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

def calculate_army_power(units: List[Unit]) -> int:
    return sum(unit.attack + unit.defense + unit.health for unit in units)

def simulate_battle(army1: Army, army2: Army) -> tuple:
    battle_log = []
    army1_power = calculate_army_power(army1.units)
    army2_power = calculate_army_power(army2.units)

    battle_log.append(f"Battle begins between {army1.player_name} and {army2.player_name}!")
    battle_log.append(f"{army1.player_name}'s army power: {army1_power}")
    battle_log.append(f"{army2.player_name}'s army power: {army2_power}")

    # Simulate battle rounds
    army1_health = sum(unit.health for unit in army1.units)
    army2_health = sum(unit.health for unit in army2.units)

    round_num = 1
    while army1_health > 0 and army2_health > 0 and round_num <= 10:
        battle_log.append(f"\nRound {round_num}:")

        # Army 1 attacks
        army1_damage = sum(unit.attack for unit in army1.units) + random.randint(-20, 20)
        army2_health -= max(0, army1_damage - sum(unit.defense for unit in army2.units) // 2)
        battle_log.append(f"{army1.player_name} deals {army1_damage} damage!")

        if army2_health <= 0:
            break

        # Army 2 attacks
        army2_damage = sum(unit.attack for unit in army2.units) + random.randint(-20, 20)
        army1_health -= max(0, army2_damage - sum(unit.defense for unit in army1.units) // 2)
        battle_log.append(f"{army2.player_name} deals {army2_damage} damage!")

        round_num += 1

    # Determine winner
    if army1_health > army2_health:
        winner_id = army1.id
        winner_name = army1.player_name
        battle_log.append(f"\n{army1.player_name} is victorious!")
    else:
        winner_id = army2.id
        winner_name = army2.player_name
        battle_log.append(f"\n{army2.player_name} is victorious!")

    return winner_id, winner_name, battle_log

# Authentication Routes
@api_router.post("/auth/signup", response_model=Token)
async def auth_signup(user: UserCreate):
    existing = await db.users.find_one({"email": user.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = hash_password(user.password)
    user_obj = User(name=user.name, email=user.email, password=hashed_pw)

    doc = user_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.users.insert_one(doc)

    # Create access token
    access_token = create_access_token(data={"sub": user_obj.id})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user_obj.id, "name": user_obj.name, "email": user_obj.email}
    }

@api_router.post("/auth/login", response_model=Token)
async def auth_login(user: UserLogin):
    db_user = await db.users.find_one({"email": user.email}, {"_id": 0})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check password
    if not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect password")

    # Create access token
    access_token = create_access_token(data={"sub": db_user["id"]})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": db_user["id"], "name": db_user["name"], "email": db_user["email"]}
    }

# Routes
@api_router.get("/")
async def root():
    return {"message": "Welcome to Warfront API"}

# Player routes
@api_router.post("/players", response_model=Player)
async def create_player(player: PlayerCreate):
    existing = await db.players.find_one({"name": player.name}, {"_id": 0})
    if existing:
        if isinstance(existing['created_at'], str):
            existing['created_at'] = datetime.fromisoformat(existing['created_at'])
        return Player(**existing)

    player_obj = Player(name=player.name)
    doc = player_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.players.insert_one(doc)
    return player_obj

@api_router.get("/players", response_model=List[Player])
async def get_players():
    players = await db.players.find({}, {"_id": 0}).to_list(1000)
    for player in players:
        if isinstance(player['created_at'], str):
            player['created_at'] = datetime.fromisoformat(player['created_at'])
    return players

@api_router.get("/players/{player_name}", response_model=Player)
async def get_player(player_name: str):
    player = await db.players.find_one({"name": player_name}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if isinstance(player['created_at'], str):
        player['created_at'] = datetime.fromisoformat(player['created_at'])
    return Player(**player)

# Army routes (Protected)
@api_router.post("/armies", response_model=Army)
async def create_army(army: ArmyCreate, current_user: dict = Depends(get_current_user)):
    player = await db.players.find_one({"name": army.player_name}, {"_id": 0})
    if not player:
        new_player = Player(name=army.player_name)
        player_doc = new_player.model_dump()
        player_doc['created_at'] = player_doc['created_at'].isoformat()
        await db.players.insert_one(player_doc)
        player_id = new_player.id
    else:
        player_id = player['id']

    army_obj = Army(
        player_id=player_id,
        player_name=army.player_name,
        units=army.units,
        total_power=calculate_army_power(army.units)
    )

    doc = army_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.armies.insert_one(doc)
    return army_obj

@api_router.get("/armies", response_model=List[Army])
async def get_armies():
    armies = await db.armies.find({}, {"_id": 0}).to_list(1000)
    for army in armies:
        if isinstance(army['created_at'], str):
            army['created_at'] = datetime.fromisoformat(army['created_at'])
    return armies

@api_router.get("/armies/{army_id}", response_model=Army)
async def get_army(army_id: str):
    army = await db.armies.find_one({"id": army_id}, {"_id": 0})
    if not army:
        raise HTTPException(status_code=404, detail="Army not found")
    if isinstance(army['created_at'], str):
        army['created_at'] = datetime.fromisoformat(army['created_at'])
    return Army(**army)

@api_router.delete("/armies/{army_id}")
async def delete_army(army_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.armies.delete_one({"id": army_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Army not found")
    return {"message": "Army deleted successfully"}

# Battle routes (Protected)
@api_router.post("/battles", response_model=Battle)
async def create_battle(battle_req: BattleRequest, current_user: dict = Depends(get_current_user)):
    army1 = await db.armies.find_one({"id": battle_req.army1_id}, {"_id": 0})
    army2 = await db.armies.find_one({"id": battle_req.army2_id}, {"_id": 0})

    if not army1 or not army2:
        raise HTTPException(status_code=404, detail="One or both armies not found")

    if isinstance(army1['created_at'], str):
        army1['created_at'] = datetime.fromisoformat(army1['created_at'])
    if isinstance(army2['created_at'], str):
        army2['created_at'] = datetime.fromisoformat(army2['created_at'])

    army1_obj = Army(**army1)
    army2_obj = Army(**army2)

    winner_id, winner_name, battle_log = simulate_battle(army1_obj, army2_obj)

    battle = Battle(
        army1_id=army1_obj.id,
        army2_id=army2_obj.id,
        army1_name=army1_obj.player_name,
        army2_name=army2_obj.player_name,
        winner_id=winner_id,
        winner_name=winner_name,
        battle_log=battle_log
    )

    doc = battle.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.battles.insert_one(doc)

    # Update player stats
    winner_player = await db.players.find_one({"name": winner_name})
    loser_name = army1_obj.player_name if winner_name == army2_obj.player_name else army2_obj.player_name
    loser_player = await db.players.find_one({"name": loser_name})

    if winner_player:
        await db.players.update_one(
            {"name": winner_name},
            {"$inc": {"wins": 1, "total_battles": 1}}
        )

    if loser_player:
        await db.players.update_one(
            {"name": loser_name},
            {"$inc": {"losses": 1, "total_battles": 1}}
        )

    return battle

@api_router.get("/battles", response_model=List[Battle])
async def get_battles():
    battles = await db.battles.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for battle in battles:
        if isinstance(battle['created_at'], str):
            battle['created_at'] = datetime.fromisoformat(battle['created_at'])
    return battles

@api_router.get("/battles/{battle_id}", response_model=Battle)
async def get_battle(battle_id: str):
    battle = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    if isinstance(battle['created_at'], str):
        battle['created_at'] = datetime.fromisoformat(battle['created_at'])
    return Battle(**battle)

# Stats endpoint
@api_router.get("/stats")
async def get_stats():
    total_players = await db.players.count_documents({})
    total_armies = await db.armies.count_documents({})
    total_battles = await db.battles.count_documents({})

    return {
        "total_players": total_players,
        "total_armies": total_armies,
        "total_battles": total_battles
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