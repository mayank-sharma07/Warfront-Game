import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { Swords, Users, Trophy, ScrollText, Plus, Trash2, Play, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast, Toaster } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const UNIT_TYPES = [
  { type: "infantry", name: "Infantry", attack: 30, defense: 20, health: 100, cost: 50 },
  { type: "tank", name: "Tank", attack: 60, defense: 50, health: 200, cost: 150 },
  { type: "artillery", name: "Artillery", attack: 80, defense: 15, health: 80, cost: 120 },
  { type: "aircraft", name: "Aircraft", attack: 100, defense: 30, health: 120, cost: 200 }
];

// Protected Route Component
const ProtectedRoute = ({ children, user }) => {
  if (!user) {
    toast.error("Please login to access this page");
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Axios interceptor for auth token
const setupAxiosInterceptor = (token) => {
  axios.interceptors.request.use((config) => {
    if (token && config.url.includes(API)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
};

const Home = () => {
  const [stats, setStats] = useState({ total_players: 0, total_armies: 0, total_battles: 0 });
  const [recentBattles, setRecentBattles] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchRecentBattles();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      setStats(response.data);
    } catch (e) {
      console.error("Error fetching stats", e);
    }
  };

  const fetchRecentBattles = async () => {
    try {
      const response = await axios.get(`${API}/battles`);
      setRecentBattles(response.data.slice(0, 5));
    } catch (e) {
      console.error("Error fetching battles", e);
    }
  };

  return (
    <div className="home-container" data-testid="home-page">
      <div className="hero-section">
        <div className="hero-content">
          <Swords className="hero-icon" size={80} />
          <h1 className="hero-title">WARFRONT</h1>
          <p className="hero-subtitle">Command Your Army. Dominate The Battlefield.</p>
          <div className="hero-buttons">
            <Link to="/armies">
              <Button size="lg" className="cta-button" data-testid="build-army-button">
                <Swords className="mr-2" size={20} />
                Build Your Army
              </Button>
            </Link>
            <Link to="/battles">
              <Button size="lg" variant="outline" className="secondary-button" data-testid="view-battles-button">
                <Trophy className="mr-2" size={20} />
                View Battles
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <Card className="stat-card" data-testid="players-stat">
          <CardHeader>
            <Users size={32} className="stat-icon" />
            <CardTitle className="stat-number">{stats.total_players}</CardTitle>
            <CardDescription>Active Commanders</CardDescription>
          </CardHeader>
        </Card>
        <Card className="stat-card" data-testid="armies-stat">
          <CardHeader>
            <Swords size={32} className="stat-icon" />
            <CardTitle className="stat-number">{stats.total_armies}</CardTitle>
            <CardDescription>Armies Deployed</CardDescription>
          </CardHeader>
        </Card>
        <Card className="stat-card" data-testid="battles-stat">
          <CardHeader>
            <Trophy size={32} className="stat-icon" />
            <CardTitle className="stat-number">{stats.total_battles}</CardTitle>
            <CardDescription>Battles Fought</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {recentBattles.length > 0 && (
        <div className="recent-battles-section">
          <h2 className="section-title">Recent Battles</h2>
          <div className="battles-grid">
            {recentBattles.map((battle) => (
              <Card key={battle.id} className="battle-card" data-testid={`recent-battle-${battle.id}`}>
                <CardHeader>
                  <CardTitle className="battle-title">
                    {battle.army1_name} vs {battle.army2_name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="battle-result">
                    <Trophy size={20} className="trophy-icon" />
                    <span className="winner-text">Winner: <strong>{battle.winner_name}</strong></span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Armies = ({ user }) => {
  const [armies, setArmies] = useState([]);
  const [playerName, setPlayerName] = useState(user?.name || "");
  const [units, setUnits] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    fetchArmies();
  }, []);

  const fetchArmies = async () => {
    try {
      const response = await axios.get(`${API}/armies`);
      setArmies(response.data);
    } catch (e) {
      console.error("Error fetching armies", e);
      toast.error("Failed to load armies");
    }
  };

  const addUnit = (unitType) => {
    const unit = UNIT_TYPES.find(u => u.type === unitType);
    if (unit) {
      setUnits([...units, { ...unit, id: Date.now().toString() }]);
      toast.success(`${unit.name} added to army`);
    }
  };

  const removeUnit = (unitId) => {
    setUnits(units.filter(u => u.id !== unitId));
    toast.info("Unit removed");
  };

  const createArmy = async () => {
    if (!playerName.trim()) {
      toast.error("Please enter a commander name");
      return;
    }
    if (units.length === 0) {
      toast.error("Please add at least one unit");
      return;
    }

    try {
      const armyPayload = {
        player_name: playerName,
        units: units.map(u => ({
          name: u.name,
          type: u.type,
          attack: u.attack,
          defense: u.defense,
          health: u.health,
          cost: u.cost
        }))
      };

      await axios.post(`${API}/armies`, armyPayload);
      toast.success("Army deployed to battlefield!");

      setPlayerName(user?.name || "");
      setUnits([]);
      setShowCreateDialog(false);
      fetchArmies();
    } catch (e) {
      console.error("Deploy Army Error:", e);
      toast.error("Failed to deploy army");
    }
  };

  const deleteArmy = async (armyId) => {
    try {
      await axios.delete(`${API}/armies/${armyId}`);
      toast.success("Army disbanded");
      fetchArmies();
    } catch (e) {
      console.error("Error deleting army", e);
      toast.error("Failed to disband army");
    }
  };

  return (
    <div className="armies-container" data-testid="armies-page">
      <div className="page-header">
        <h1 className="page-title">Army Command</h1>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="create-button" data-testid="create-army-button">
              <Plus className="mr-2" size={20} />
              Create New Army
            </Button>
          </DialogTrigger>
          <DialogContent className="create-dialog" data-testid="create-army-dialog">
            <DialogHeader>
              <DialogTitle>Build Your Army</DialogTitle>
            </DialogHeader>
            <div className="dialog-content">
              <div className="form-group">
                <Label htmlFor="commander">Commander Name</Label>
                <Input
                  id="commander"
                  data-testid="commander-name-input"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>

              <div className="units-section">
                <Label>Select Units</Label>
                <div className="unit-types-grid">
                  {UNIT_TYPES.map((unit) => (
                    <Button
                      key={unit.type}
                      data-testid={`add-${unit.type}-button`}
                      variant="outline"
                      className="unit-type-button"
                      onClick={() => addUnit(unit.type)}
                    >
                      <Plus size={16} className="mr-2" />
                      {unit.name}
                      <div className="unit-stats">
                        <span>⚔️{unit.attack}</span>
                        <span>🛡️{unit.defense}</span>
                        <span>❤️{unit.health}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {units.length > 0 && (
                <div className="selected-units" data-testid="selected-units-list">
                  <Label>Your Army ({units.length} units)</Label>
                  <ScrollArea className="units-list">
                    {units.map((unit) => (
                      <div key={unit.id} className="unit-item" data-testid={`unit-${unit.id}`}>
                        <span>{unit.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`remove-unit-${unit.id}`}
                          onClick={() => removeUnit(unit.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}

              <Button
                className="submit-button"
                data-testid="submit-army-button"
                onClick={createArmy}
                disabled={!playerName || units.length === 0}
              >
                Deploy Army
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="armies-grid">
        {armies.map((army) => (
          <Card key={army.id} className="army-card" data-testid={`army-card-${army.id}`}>
            <CardHeader>
              <CardTitle className="army-title">{army.player_name}'s Army</CardTitle>
              <CardDescription>
                <Badge variant="secondary" className="power-badge">
                  Power: {army.total_power}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="army-units">
                <Label className="units-label">{army.units.length} Units:</Label>
                <div className="unit-badges">
                  {army.units.map((unit) => (
                    <Badge key={unit.id} variant="outline" className="unit-badge">
                      {unit.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="delete-button"
                data-testid={`delete-army-${army.id}`}
                onClick={() => deleteArmy(army.id)}
              >
                <Trash2 size={16} className="mr-2" />
                Disband
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {armies.length === 0 && (
        <div className="empty-state" data-testid="no-armies-message">
          <Swords size={64} className="empty-icon" />
          <p>No armies deployed yet. Create your first army to begin!</p>
        </div>
      )}
    </div>
  );
};

const Battles = () => {
  const [armies, setArmies] = useState([]);
  const [battles, setBattles] = useState([]);
  const [army1Id, setArmy1Id] = useState("");
  const [army2Id, setArmy2Id] = useState("");
  const [selectedBattle, setSelectedBattle] = useState(null);

  useEffect(() => {
    fetchArmies();
    fetchBattles();
  }, []);

  const fetchArmies = async () => {
    try {
      const response = await axios.get(`${API}/armies`);
      setArmies(response.data);
    } catch (e) {
      console.error("Error fetching armies", e);
    }
  };

  const fetchBattles = async () => {
    try {
      const response = await axios.get(`${API}/battles`);
      setBattles(response.data);
    } catch (e) {
      console.error("Error fetching battles", e);
    }
  };

  const startBattle = async () => {
    if (!army1Id || !army2Id) {
      toast.error("Please select two armies for battle");
      return;
    }
    if (army1Id === army2Id) {
      toast.error("An army cannot battle itself!");
      return;
    }

    try {
      const response = await axios.post(`${API}/battles`, {
        army1_id: army1Id,
        army2_id: army2Id
      });
      toast.success("Battle complete!");
      setSelectedBattle(response.data);
      setArmy1Id("");
      setArmy2Id("");
      fetchBattles();
    } catch (e) {
      console.error("Error creating battle", e);
      toast.error("Failed to start battle");
    }
  };

  return (
    <div className="battles-container" data-testid="battles-page">
      <div className="page-header">
        <h1 className="page-title">Battle Arena</h1>
      </div>

      <Tabs defaultValue="create" className="battles-tabs">
        <TabsList className="tabs-list">
          <TabsTrigger value="create" data-testid="create-battle-tab">Start Battle</TabsTrigger>
          <TabsTrigger value="history" data-testid="battle-history-tab">Battle History</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="tab-content" data-testid="create-battle-content">
          <Card className="battle-setup-card">
            <CardHeader>
              <CardTitle>Deploy Armies</CardTitle>
              <CardDescription>Select two armies to engage in battle</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="battle-setup">
                <div className="army-select">
                  <Label htmlFor="army1">Army 1</Label>
                  <select
                    id="army1"
                    data-testid="army1-select"
                    className="select-input"
                    value={army1Id}
                    onChange={(e) => setArmy1Id(e.target.value)}
                  >
                    <option value="">Select Army</option>
                    {armies.map((army) => (
                      <option key={army.id} value={army.id}>
                        {army.player_name}'s Army (Power: {army.total_power})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vs-divider">
                  <Swords size={32} className="vs-icon" />
                </div>

                <div className="army-select">
                  <Label htmlFor="army2">Army 2</Label>
                  <select
                    id="army2"
                    data-testid="army2-select"
                    className="select-input"
                    value={army2Id}
                    onChange={(e) => setArmy2Id(e.target.value)}
                  >
                    <option value="">Select Army</option>
                    {armies.map((army) => (
                      <option key={army.id} value={army.id}>
                        {army.player_name}'s Army (Power: {army.total_power})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                className="battle-button"
                data-testid="start-battle-button"
                onClick={startBattle}
                disabled={!army1Id || !army2Id}
              >
                <Play className="mr-2" size={20} />
                Engage Battle
              </Button>

              {selectedBattle && (
                <div className="battle-result" data-testid="battle-result">
                  <h3 className="result-title">Battle Report</h3>
                  <div className="winner-announcement">
                    <Trophy size={32} className="trophy-icon" />
                    <p className="winner-text">
                      <strong>{selectedBattle.winner_name}</strong> is victorious!
                    </p>
                  </div>
                  <ScrollArea className="battle-log" data-testid="battle-log">
                    {selectedBattle.battle_log.map((log, index) => (
                      <p key={index} className="log-entry">{log}</p>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="tab-content" data-testid="battle-history-content">
          <div className="history-grid">
            {battles.map((battle) => (
              <Card key={battle.id} className="history-card" data-testid={`battle-history-${battle.id}`}>
                <CardHeader>
                  <CardTitle className="history-title">
                    {battle.army1_name} vs {battle.army2_name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="history-result">
                    <Trophy size={20} className="trophy-icon" />
                    <span>Winner: <strong>{battle.winner_name}</strong></span>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="view-log-button" data-testid={`view-log-${battle.id}`}>
                        <ScrollText size={16} className="mr-2" />
                        View Battle Log
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="log-dialog">
                      <DialogHeader>
                        <DialogTitle>Battle Log</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="dialog-log">
                        {battle.battle_log.map((log, index) => (
                          <p key={index} className="log-entry">{log}</p>
                        ))}
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>

          {battles.length === 0 && (
            <div className="empty-state" data-testid="no-battles-message">
              <Trophy size={64} className="empty-icon" />
              <p>No battles have been fought yet. Start your first battle!</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Leaderboard = () => {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      const response = await axios.get(`${API}/players`);
      const sorted = response.data.sort((a, b) => b.wins - a.wins);
      setPlayers(sorted);
    } catch (e) {
      console.error("Error fetching players", e);
    }
  };

  return (
    <div className="leaderboard-container" data-testid="leaderboard-page">
      <div className="page-header">
        <h1 className="page-title">Leaderboard</h1>
      </div>

      <Card className="leaderboard-card">
        <CardContent className="leaderboard-content">
          <div className="leaderboard-table">
            <div className="table-header" data-testid="leaderboard-header">
              <span>Rank</span>
              <span>Commander</span>
              <span>Wins</span>
              <span>Losses</span>
              <span>Total Battles</span>
              <span>Win Rate</span>
            </div>
            {players.map((player, index) => (
              <div key={player.id} className="table-row" data-testid={`player-row-${player.id}`}>
                <span className="rank">
                  {index === 0 && <Trophy size={20} className="gold" />}
                  {index === 1 && <Trophy size={20} className="silver" />}
                  {index === 2 && <Trophy size={20} className="bronze" />}
                  {index > 2 && `#${index + 1}`}
                </span>
                <span className="name">{player.name}</span>
                <span className="wins">{player.wins}</span>
                <span className="losses">{player.losses}</span>
                <span className="total">{player.total_battles}</span>
                <span className="winrate">
                  {player.total_battles > 0
                    ? `${((player.wins / player.total_battles) * 100).toFixed(1)}%`
                    : "0%"}
                </span>
              </div>
            ))}
          </div>

          {players.length === 0 && (
            <div className="empty-state" data-testid="no-players-message">
              <Users size={64} className="empty-icon" />
              <p>No commanders yet. Be the first to enter the battlefield!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      setupAxiosInterceptor(token);
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    const token = localStorage.getItem('token');
    setupAxiosInterceptor(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    toast.success("Logged out successfully");
  };

  return (
    <div className="App">
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <nav className="navbar" data-testid="navbar">
          <Link to="/" className="nav-brand" data-testid="nav-brand">
            <Swords size={28} />
            <span>WARFRONT</span>
          </Link>
          <div className="nav-links">
            <Link to="/" className="nav-link" data-testid="nav-home">Home</Link>
            <Link to="/armies" className="nav-link" data-testid="nav-armies">Armies</Link>
            <Link to="/battles" className="nav-link" data-testid="nav-battles">Battles</Link>
            <Link to="/leaderboard" className="nav-link" data-testid="nav-leaderboard">Leaderboard</Link>
            {!user ? (
              <>
                <Link to="/login" className="nav-link" data-testid="nav-login">Login</Link>
                <Link to="/signup" className="nav-link" data-testid="nav-signup">Signup</Link>
              </>
            ) : (
              <div className="user-menu">
                <span className="user-name">{user.name}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogout}
                  data-testid="logout-button"
                >
                  <LogOut size={16} className="mr-2" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route 
            path="/armies" 
            element={
              <ProtectedRoute user={user}>
                <Armies user={user} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/battles" 
            element={
              <ProtectedRoute user={user}>
                <Battles />
              </ProtectedRoute>
            } 
          />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/signup" element={<Signup onLogin={handleLogin} />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
