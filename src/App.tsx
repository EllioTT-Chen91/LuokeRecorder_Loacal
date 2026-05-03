import {
  useState,
  useEffect,
  useMemo,
  useRef,
  FormEvent,
  ChangeEvent,
} from "react";
import {
  Plus,
  Trash2,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
  Database,
  History,
  TrendingDown,
  Sparkles,
  Edit2,
  Save,
  X,
  Minus,
  Calculator,
  Trophy,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
  User,
  LogOut,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { HuntRecord, POLLUTION_LIMIT, PollutionSession } from "./types.ts";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [user, setUser] = useState<{ username: string } | null>(() => {
    const saved = localStorage.getItem("roco-user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("roco-token"),
  );

  const [hunts, setHunts] = useState<HuntRecord[]>(() => {
    try {
      const saved = localStorage.getItem("roco-hunts");
      const parsed = saved ? JSON.parse(saved) : [];
      return parsed.map((h: any) => ({
        ...h,
        history: h.history || [],
      }));
    } catch (e) {
      console.error("Failed to load hunts from localStorage", e);
      return [];
    }
  });

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");

  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newPetName, setNewPetName] = useState("");
  const [newTotalBalls, setNewTotalBalls] = useState(100);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Auth & Data Sync ---
  useEffect(() => {
    if (token) {
      fetchHunts();
    }
  }, [token]);

  useEffect(() => {
    localStorage.setItem("roco-hunts", JSON.stringify(hunts));
  }, [hunts]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "pending" | "error">(
    "synced",
  );

  const fetchHunts = async () => {
    if (!token) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/hunts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const remoteData: HuntRecord[] = await res.json();

        setHunts((prevHunts) => {
          // 使用 Map 以 ID 为键进行合并，确保唯一
          const huntMap = new Map<string, HuntRecord>();

          // 先放云端数据
          remoteData.forEach((h) => huntMap.set(h.id, h));

          // 再放本地数据（如果本地更新时间更晚，则覆盖并同步）
          prevHunts.forEach((local) => {
            const remote = huntMap.get(local.id);
            if (!remote) {
              huntMap.set(local.id, local);
              syncSingleHunt(local, "create");
            } else if ((local.updatedAt || 0) > (remote.updatedAt || 0)) {
              huntMap.set(local.id, local);
              syncSingleHunt(local, "update");
            }
          });

          return Array.from(huntMap.values()).sort(
            (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
          );
        });
        setSyncStatus("synced");
      } else {
        setSyncStatus("error");
      }
    } catch (err) {
      console.error("Failed to fetch hunts", err);
      setSyncStatus("error");
    } finally {
      setIsSyncing(false);
    }
  };

  const syncSingleHunt = async (
    hunt: HuntRecord,
    mode: "create" | "update" = "update",
  ) => {
    if (!token) return;
    setSyncStatus("pending");
    try {
      const url =
        mode === "create"
          ? `${API_BASE_URL}/api/hunts`
          : `${API_BASE_URL}/api/hunts/${hunt.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(hunt),
      });
      if (res.ok) setSyncStatus("synced");
      else setSyncStatus("error");
    } catch (err) {
      setSyncStatus("error");
    }
  };

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const endpoint =
        authMode === "login"
          ? `${API_BASE_URL}/api/login`
          : `${API_BASE_URL}/api/register`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem("roco-user", JSON.stringify(data.user));
        localStorage.setItem("roco-token", data.token);
        setIsAuthOpen(false);
        setAuthForm({ username: "", password: "" });
      } else {
        setAuthError(data.error);
      }
    } catch (err) {
      setAuthError("Authentication failed");
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("roco-user");
    localStorage.removeItem("roco-token");
    setHunts([]); // Clear on logout or keep local? User probably wants to clear.
  };

  const addHunt = async () => {
    if (!newPetName.trim()) return;

    const newHunt: HuntRecord = {
      id: crypto.randomUUID(),
      petName: newPetName,
      totalBalls: newTotalBalls,
      remainingBalls: newTotalBalls,
      pollutionCount: 0,
      isShiny: false,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedHunts = [newHunt, ...hunts];
    setHunts(updatedHunts);
    setNewPetName("");
    setIsAdding(false);

    if (token) {
      syncSingleHunt(newHunt, "create");
    }
  };

  const deleteHunt = async (id: string) => {
    setHunts(hunts.filter((h) => h.id !== id));
    setDeletingId(null);

    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/hunts/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error("Failed to delete hunt on server", err);
      }
    }
  };

  const updateHunt = async (id: string, updates: Partial<HuntRecord>) => {
    const updatedHunts = hunts.map((h) => {
      if (h.id === id) {
        const updated = { ...h, ...updates, updatedAt: Date.now() };
        if (token) {
          syncSingleHunt(updated, "update");
        }
        return updated;
      }
      return h;
    });
    setHunts(updatedHunts);
  };

  // --- Export / Import ---
  const exportData = () => {
    const dataStr = JSON.stringify(hunts, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = `locke_records_${new Date().toISOString().split("T")[0]}.json`;
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  const importData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        if (Array.isArray(imported)) {
          setHunts((prev) => {
            const huntMap = new Map<string, HuntRecord>();
            // 先加载现有数据
            prev.forEach((h) => huntMap.set(h.id, h));

            // 逐个处理导入的数据
            imported.forEach((newHunt: HuntRecord) => {
              const existing = huntMap.get(newHunt.id);
              // 如果不存在，或者导入的更新时间更晚，则采用
              if (
                !existing ||
                (newHunt.updatedAt || 0) > (existing.updatedAt || 0)
              ) {
                huntMap.set(newHunt.id, newHunt);
                // 自动同步到云端
                if (token) {
                  syncSingleHunt(newHunt, existing ? "update" : "create");
                }
              }
            });
            return Array.from(huntMap.values()).sort(
              (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
            );
          });
          alert("数据导入并同步成功！");
        }
      } catch (err) {
        alert("导入失败，请检查文件格式。");
      }
    };
    reader.readAsText(file);
  };

  const totalBallsUsed = useMemo(() => {
    return hunts.reduce((acc, h) => acc + (h.totalBalls - h.remainingBalls), 0);
  }, [hunts]);

  const globalStats = useMemo(() => {
    const totalBalls = hunts.reduce(
      (acc, h) => acc + (h.totalBalls - h.remainingBalls),
      0,
    );
    const totalPollution = hunts.reduce((acc, h) => acc + h.pollutionCount, 0);
    const avg =
      totalPollution > 0 ? (totalBalls / totalPollution).toFixed(1) : "0.0";
    return {
      avg,
      totalCaptured: hunts.filter((h) => h.isShiny).length,
      totalBalls,
    };
  }, [hunts]);

  const activeHunts = hunts.filter((h) => !h.isShiny);
  const completedHunts = hunts.filter((h) => h.isShiny);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans antialiased text-slate-900 leading-tight">
      {/* Top Professional Dashboard */}
      <div className="bg-slate-900 px-6 pt-12 pb-24 text-white leading-tight">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="flex items-center gap-4 text-3xl font-black tracking-tight">
                <div className="h-10 w-2.5 rounded-full bg-blue-500"></div>
                LOCKE RECORD
              </h1>
              <p className="pl-6 text-xs font-black uppercase tracking-[0.4em] text-slate-500">
                {user
                  ? `欢迎回来, ${user.username}`
                  : "捕捉轨迹分析终端 · V2.1 Professional"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  {user && (
                    <button
                      onClick={fetchHunts}
                      disabled={isSyncing}
                      className={`flex h-10 px-3 items-center gap-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                        syncStatus === "synced"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : syncStatus === "error"
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${isSyncing ? "animate-pulse bg-blue-500" : syncStatus === "synced" ? "bg-emerald-500" : "bg-red-500"}`}
                      />
                      {isSyncing
                        ? "同步中..."
                        : syncStatus === "synced"
                          ? "云端已同步"
                          : "同步失败"}
                    </button>
                  )}
                  <button
                    onClick={exportData}
                    className="flex h-10 px-4 items-center gap-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    <Download size={14} /> 导出备份
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-10 px-4 items-center gap-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    <Upload size={14} /> 导入数据
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={importData}
                    accept=".json"
                    className="hidden"
                  />
                </div>
                <button
                  onClick={() => (user ? logout() : setIsAuthOpen(true))}
                  className={`flex h-10 px-4 items-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${user ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-blue-600 text-white shadow-lg shadow-blue-500/30"}`}
                >
                  {user ? (
                    <>
                      <LogOut size={14} /> 退出登录
                    </>
                  ) : (
                    <>
                      <User size={14} /> 登录同步
                    </>
                  )}
                </button>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsAdding(true)}
                className="flex h-16 w-16 items-center justify-center rounded-[2rem] bg-blue-600 font-bold text-white shadow-2xl shadow-blue-500/30 active:scale-95 transition-all"
              >
                <Plus size={32} />
              </motion.button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-[3rem] bg-white/5 border border-white/10 p-8 space-y-2">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">
                全周期捕捉效率分析 (Global Avg)
              </p>
              <div className="flex items-baseline gap-3">
                <p className="text-5xl font-black text-blue-400 font-mono tracking-tighter">
                  {globalStats.avg}
                </p>
                <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">
                  咕噜球 / 污染
                </span>
              </div>
            </div>
            <div className="rounded-[3rem] bg-emerald-500/10 border border-emerald-500/20 p-8 space-y-2">
              <p className="text-xs font-black text-emerald-500/50 uppercase tracking-widest leading-none">
                已归档出货量 (Shipments)
              </p>
              <div className="flex items-baseline gap-3">
                <p className="text-5xl font-black text-emerald-400 font-mono tracking-tighter">
                  {globalStats.totalCaptured}
                </p>
                <Trophy size={24} className="text-emerald-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 -mt-12 space-y-16">
        {/* Active Hunts */}
        <section>
          <div className="flex items-center justify-between mb-6 px-4">
            <h2 className="font-black text-slate-900 text-lg flex items-center gap-2">
              <History size={20} className="text-blue-600" />
              正在进行的记录
            </h2>
            <span className="text-[10px] font-black bg-blue-600 text-white px-3 py-1 rounded-full uppercase tracking-widest">
              {activeHunts.length} Active
            </span>
          </div>

          {activeHunts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] p-16 text-center"
            >
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                <ShieldAlert size={40} />
              </div>
              <p className="text-slate-400 font-bold text-sm mb-6">
                目前还没有任何捕捉记录...
              </p>
              <button
                onClick={() => setIsAdding(true)}
                className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors"
              >
                点我创建新纪录表
              </button>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {activeHunts.map((hunt) => (
                  <HuntCard
                    key={hunt.id}
                    hunt={hunt}
                    onUpdate={updateHunt}
                    onDeleteRequest={(id: string) => setDeletingId(id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deletingId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeletingId(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl relative z-10 text-center"
              >
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6 mx-auto">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-black mb-2">确定删除吗？</h3>
                <p className="text-slate-400 text-sm font-bold mb-8">
                  此操作无法撤销，记录将被永久移除。
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingId(null)}
                    className="flex-1 py-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => deleteHunt(deletingId)}
                    className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-100 hover:bg-red-600 transition-colors"
                  >
                    确认删除
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Completed Feed */}
        {completedHunts.length > 0 && (
          <section className="pt-12 border-t border-slate-200">
            <div className="flex items-center justify-between mb-8 px-4">
              <h2 className="font-black text-slate-400 text-sm flex items-center gap-2 uppercase tracking-widest">
                <Trophy size={16} className="text-emerald-500" />
                最近辉煌 (已归档)
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <AnimatePresence>
                {completedHunts.map((hunt) => (
                  <div key={hunt.id} className="space-y-4">
                    <HuntCard
                      hunt={hunt}
                      onUpdate={updateHunt}
                      onDeleteRequest={setDeletingId}
                    />
                  </div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-950/20 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative z-10"
            >
              <div className="w-16 h-16 bg-blue-600 text-white rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-100">
                <Plus size={32} strokeWidth={3} />
              </div>

              <h3 className="text-2xl font-black mb-8 tracking-tighter">
                开始一个新的猎取表
              </h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">
                    宠物名称
                  </label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="请输入宠物名"
                    value={newPetName}
                    onChange={(e) => setNewPetName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-4 focus:ring-0 focus:border-blue-600 outline-none transition-all text-sm font-bold placeholder:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">
                    已有咕噜球总数
                  </label>
                  <input
                    type="number"
                    value={newTotalBalls}
                    onChange={(e) => setNewTotalBalls(Number(e.target.value))}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-4 focus:ring-0 focus:border-blue-600 outline-none transition-all text-sm font-bold"
                  />
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-5 rounded-3xl font-black text-sm text-slate-400 hover:bg-slate-50 transition-colors uppercase tracking-widest"
                >
                  取消
                </button>
                <button
                  onClick={addHunt}
                  className="flex-1 py-5 bg-blue-600 text-white rounded-3xl font-black text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors uppercase tracking-widest"
                >
                  建立表格
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthOpen(false)}
              className="absolute inset-0 bg-slate-950/20 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative z-10"
            >
              <div className="w-16 h-16 bg-blue-600 text-white rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-100">
                <Lock size={32} />
              </div>

              <h3 className="text-2xl font-black mb-2 tracking-tighter">
                {authMode === "login" ? "欢迎回来" : "开启云同步"}
              </h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-8">
                {authMode === "login"
                  ? "请输入您的凭据以同步数据"
                  : "创建一个账号来持久化您的猎取记录"}
              </p>

              <form onSubmit={handleAuth} className="space-y-6">
                {authError && (
                  <div className="bg-red-50 text-red-500 p-3 rounded-2xl text-[10px] font-bold text-center uppercase tracking-widest border border-red-100">
                    {authError}
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">
                    用户名
                  </label>
                  <input
                    type="text"
                    required
                    value={authForm.username}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, username: e.target.value })
                    }
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-4 focus:ring-0 focus:border-blue-600 outline-none transition-all text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">
                    密码
                  </label>
                  <input
                    type="password"
                    required
                    value={authForm.password}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, password: e.target.value })
                    }
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-4 focus:ring-0 focus:border-blue-600 outline-none transition-all text-sm font-bold"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors uppercase tracking-widest"
                >
                  {authMode === "login" ? "立即登录" : "立即注册"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() =>
                    setAuthMode(authMode === "login" ? "register" : "login")
                  }
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
                >
                  {authMode === "login"
                    ? "没有账号？去注册"
                    : "已有账号？去登录"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface HuntCardProps {
  hunt: HuntRecord;
  onUpdate: (id: string, updates: Partial<HuntRecord>) => void;
  onDeleteRequest: (id: string) => void;
  key?: string | number;
}

function HuntCard({ hunt, onUpdate, onDeleteRequest }: HuntCardProps) {
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [isRecordSessionOpen, setIsRecordSessionOpen] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  const [tempTotal, setTempTotal] = useState(hunt.totalBalls);
  const [tempRemain, setTempRemain] = useState(hunt.remainingBalls);
  const [tempPollution, setTempPollution] = useState(hunt.pollutionCount);

  const [sessionPollution, setSessionPollution] = useState(1);
  const [sessionRemainingBalls, setSessionRemainingBalls] = useState(
    hunt.remainingBalls,
  );

  // For editing historical sessions
  const [editSessionPollution, setEditSessionPollution] = useState(0);
  const [editSessionBallsUsed, setEditSessionBallsUsed] = useState(0);

  const ballsUsed = hunt.totalBalls - hunt.remainingBalls;
  const progressPercent = Math.min(
    (hunt.pollutionCount / POLLUTION_LIMIT) * 100,
    100,
  );

  const ballsUsedInCurrentSession = useMemo(() => {
    return Math.max(0, hunt.remainingBalls - sessionRemainingBalls);
  }, [hunt.remainingBalls, sessionRemainingBalls]);

  const avgBallsPerPollution = useMemo(() => {
    return hunt.pollutionCount > 0
      ? (ballsUsed / hunt.pollutionCount).toFixed(1)
      : "0";
  }, [ballsUsed, hunt.pollutionCount]);

  const chartData = useMemo(() => {
    return (hunt.history || []).map((session, index) => ({
      name: `阶段${index + 1}`,
      avg:
        session.pollutionDiff > 0
          ? Number((session.ballsUsed / session.pollutionDiff).toFixed(1))
          : 0,
      balls: session.ballsUsed,
      pollution: session.pollutionDiff,
      id: session.id,
    }));
  }, [hunt.history]);

  const saveSettings = () => {
    onUpdate(hunt.id, {
      totalBalls: tempTotal,
      remainingBalls: tempRemain,
      pollutionCount: tempPollution,
    });
    setIsEditingSettings(false);
  };

  const recordSession = () => {
    if (sessionPollution <= 0) return;

    const realBallsUsed = Math.max(
      0,
      hunt.remainingBalls - sessionRemainingBalls,
    );

    const newSession: PollutionSession = {
      id: crypto.randomUUID(),
      pollutionDiff: sessionPollution,
      ballsUsed: realBallsUsed,
      timestamp: Date.now(),
    };

    onUpdate(hunt.id, {
      remainingBalls: sessionRemainingBalls,
      pollutionCount: Math.min(
        POLLUTION_LIMIT,
        hunt.pollutionCount + sessionPollution,
      ),
      history: [...(hunt.history || []), newSession],
    });

    setIsRecordSessionOpen(false);
    setSessionPollution(1);
  };

  const updateSession = (sessionId: string) => {
    const updatedHistory = (hunt.history || []).map((s) => {
      if (s.id === sessionId) {
        return {
          ...s,
          pollutionDiff: editSessionPollution,
          ballsUsed: editSessionBallsUsed,
        };
      }
      return s;
    });

    const totalPollution = updatedHistory.reduce(
      (acc, s) => acc + s.pollutionDiff,
      0,
    );
    const totalBallsUsed = updatedHistory.reduce(
      (acc, s) => acc + s.ballsUsed,
      0,
    );

    onUpdate(hunt.id, {
      pollutionCount: totalPollution,
      remainingBalls: hunt.totalBalls - totalBallsUsed,
      history: updatedHistory,
    });
    setEditingSessionId(null);
  };

  const deleteSession = (sessionId: string) => {
    const confirmDelete = window.confirm(
      "确定要删除这条清理记录吗？\n删除后主界面的污染计数和剩余球数将自动回退。",
    );
    if (!confirmDelete) return;

    const updatedHistory = (hunt.history || []).filter(
      (s) => s.id !== sessionId,
    );
    const totalPollution = updatedHistory.reduce(
      (acc, s) => acc + s.pollutionDiff,
      0,
    );
    const totalBallsUsed = updatedHistory.reduce(
      (acc, s) => acc + s.ballsUsed,
      0,
    );

    onUpdate(hunt.id, {
      pollutionCount: totalPollution,
      remainingBalls: hunt.totalBalls - totalBallsUsed,
      history: updatedHistory,
    });

    if (editingSessionId === sessionId) {
      setEditingSessionId(null);
    }
  };

  const archiveCatch = () => {
    if (window.confirm("恭喜！完成当前捕捉了吗？确定后将归档至“最近辉煌”。")) {
      onUpdate(hunt.id, { isShiny: true });
    }
  };

  useEffect(() => {
    if (isRecordSessionOpen) {
      setSessionRemainingBalls(hunt.remainingBalls);
    }
  }, [hunt.remainingBalls, isRecordSessionOpen]);

  return (
    <motion.div
      layout
      className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-blue-100 flex-shrink-0">
              <span className="text-2xl font-black uppercase leading-none">
                {hunt.petName.slice(0, 1)}
              </span>
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-900 tracking-tight mb-1">
                {hunt.petName}
              </h3>
              <p className="text-[9px] text-slate-400 font-black flex items-center gap-1.5 uppercase tracking-widest">
                <RotateCcw size={10} className="text-blue-500" />
                最近更新{" "}
                {new Date(hunt.updatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            <button
              onClick={() => {
                setTempTotal(hunt.totalBalls);
                setTempRemain(hunt.remainingBalls);
                setTempPollution(hunt.pollutionCount);
                setIsEditingSettings(!isEditingSettings);
              }}
              className={`p-2.5 rounded-xl transition-all ${isEditingSettings ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-white hover:text-blue-600"}`}
            >
              <Edit2 size={18} />
            </button>
            <button
              onClick={() => onDeleteRequest(hunt.id)}
              className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-white rounded-xl transition-all"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {hunt.isShiny && (
          <div className="mb-6 bg-gradient-to-r from-emerald-50 to-emerald-50/30 border border-emerald-100 p-4 rounded-3xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-sm shadow-emerald-100">
                <Trophy size={20} />
              </div>
              <div>
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">
                  荣誉殿堂
                </p>
                <p className="text-sm font-black text-emerald-900">
                  恭喜！这项捕捉已成功归档
                </p>
              </div>
            </div>
            <button
              onClick={() => onUpdate(hunt.id, { isShiny: false })}
              className="px-4 py-2 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors flex items-center gap-2 text-[10px] font-black uppercase whitespace-nowrap"
            >
              <RotateCcw size={14} /> 恢复记录
            </button>
          </div>
        )}

        <div
          className={`grid grid-cols-3 gap-3 mb-8 ${hunt.isShiny ? "opacity-75" : ""}`}
        >
          <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 text-center">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
              已用球
            </p>
            <p className="text-xl font-black text-slate-900 leading-none">
              {ballsUsed}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-[2rem] border border-blue-100 text-center">
            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">
              剩余球
            </p>
            <p className="text-xl font-black text-blue-600 leading-none">
              {hunt.remainingBalls}
            </p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-[2rem] border border-emerald-100 text-center">
            <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">
              平均球耗
            </p>
            <p className="text-xl font-black text-emerald-600 leading-none">
              {avgBallsPerPollution}
            </p>
          </div>
        </div>

        <div className="mb-10">
          <div className="flex justify-between items-end mb-3 px-2">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">
                污染保底进度汇整
              </p>
              <span className="text-sm font-black text-slate-800">
                {hunt.pollutionCount}{" "}
                <span className="text-slate-300">/ {POLLUTION_LIMIT}</span>
              </span>
            </div>
            <span className="text-2xl font-black text-blue-600 tracking-tighter">
              {Math.round(progressPercent)}%
            </span>
          </div>

          <div className="h-6 w-full bg-slate-50 rounded-2xl p-1 border border-slate-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              className={`h-full rounded-xl transition-all duration-700 relative overflow-hidden ${progressPercent === 100 ? "bg-emerald-500" : "bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)]"}`}
            >
              {progressPercent > 5 && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent animate-pulse" />
              )}
            </motion.div>
          </div>
        </div>

        {/* Actions Area */}
        <div className="space-y-4">
          {!hunt.isShiny &&
            (!isEditingSettings ? (
              <>
                <button
                  onClick={() => setIsRecordSessionOpen(!isRecordSessionOpen)}
                  className={`w-full py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${isRecordSessionOpen ? "bg-slate-900 text-white" : "bg-blue-600 text-white shadow-xl shadow-blue-100"}`}
                >
                  {isRecordSessionOpen ? (
                    <>
                      <X size={20} /> 取消录入
                    </>
                  ) : (
                    <>
                      <Calculator size={20} /> 录入新清理记录
                    </>
                  )}
                </button>

                <AnimatePresence>
                  {isRecordSessionOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-slate-50 border border-slate-200 rounded-[2.5rem] p-8 space-y-8 mt-2">
                        <div className="grid grid-cols-1 gap-6">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-4">
                              刚才清理了多少个污染？
                            </label>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() =>
                                  setSessionPollution(
                                    Math.max(1, sessionPollution - 1),
                                  )
                                }
                                className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                <Minus size={20} />
                              </button>
                              <input
                                type="number"
                                value={sessionPollution}
                                onChange={(e) =>
                                  setSessionPollution(Number(e.target.value))
                                }
                                className="flex-1 h-14 bg-white border border-slate-200 rounded-2xl px-6 text-center text-lg font-black outline-none focus:border-blue-600 transition-colors"
                              />
                              <button
                                onClick={() =>
                                  setSessionPollution(sessionPollution + 1)
                                }
                                className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                <Plus size={20} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-4">
                              清理后剩余几个咕噜球？
                            </label>
                            <input
                              type="number"
                              value={sessionRemainingBalls}
                              onChange={(e) =>
                                setSessionRemainingBalls(Number(e.target.value))
                              }
                              className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-8 text-lg font-black outline-none focus:border-blue-600 transition-colors"
                            />
                            <div className="mt-4 flex items-center justify-between px-2">
                              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                本次球耗计算
                              </p>
                              <p className="text-sm font-black text-blue-600">
                                {ballsUsedInCurrentSession} 咕噜球
                              </p>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={recordSession}
                          disabled={sessionRemainingBalls > hunt.remainingBalls}
                          className="w-full bg-blue-600 text-white h-14 rounded-2xl font-black text-sm uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          确认结算并同步进度
                        </button>
                        {sessionRemainingBalls > hunt.remainingBalls && (
                          <p className="text-[10px] text-red-500 font-bold text-center">
                            提示：录入剩余球数不能大于当前总数 (
                            {hunt.remainingBalls})
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="bg-blue-50 border border-blue-100 rounded-[2.5rem] p-8 space-y-6">
                <h4 className="text-sm font-black text-blue-600 uppercase tracking-widest px-2">
                  手动校准历史数据
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-blue-400 uppercase ml-2">
                      初始咕噜球
                    </label>
                    <input
                      type="number"
                      value={tempTotal}
                      onChange={(e) => setTempTotal(Number(e.target.value))}
                      className="w-full p-4 bg-white rounded-2xl border-none font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-blue-400 uppercase ml-2">
                      当前剩余
                    </label>
                    <input
                      type="number"
                      value={tempRemain}
                      onChange={(e) => setTempRemain(Number(e.target.value))}
                      className="w-full p-4 bg-white rounded-2xl border-none font-bold text-sm"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="text-[9px] font-black text-blue-400 uppercase ml-2">
                      污染总计
                    </label>
                    <input
                      type="number"
                      value={tempPollution}
                      onChange={(e) => setTempPollution(Number(e.target.value))}
                      className="w-full p-4 bg-white rounded-2xl border-none font-bold text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveSettings}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-blue-100"
                  >
                    保存修改
                  </button>
                  <button
                    onClick={() => setIsEditingSettings(false)}
                    className="px-6 bg-white text-slate-400 rounded-2xl font-bold border border-slate-200"
                  >
                    取消
                  </button>
                </div>
              </div>
            ))}
        </div>

        {hunt.history && hunt.history.length > 0 && (
          <div className="mt-8 pt-8 border-t border-slate-100 space-y-8 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center sm:text-left">
                  阶段捕获效率分析
                </p>
                <div className="flex items-baseline gap-1 justify-center sm:justify-start">
                  <span className="text-3xl font-black text-blue-600 tracking-tighter">
                    {avgBallsPerPollution}
                  </span>
                  <span className="text-[10px] font-bold text-blue-400 uppercase">
                    平均球耗 / 污染
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => setShowChart(!showChart)}
                  className="bg-slate-50 text-slate-600 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-100 transition-colors shadow-sm"
                >
                  <BarChart3 size={16} />
                  {showChart ? "退出统计模式" : "展开效率明细"}
                </button>

                {!hunt.isShiny && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      archiveCatch();
                    }}
                    className="flex h-12 items-center gap-2 bg-emerald-500 text-white px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-600 active:scale-95 transition-all mt-2"
                  >
                    <Trophy size={16} />
                    出货归档
                  </button>
                )}
              </div>
            </div>

            <AnimatePresence>
              {showChart && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-8"
                >
                  <div className="h-[240px] w-full bg-slate-50 p-4 rounded-[2.5rem] border border-slate-100">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="name"
                          stroke="#94a3b8"
                          fontSize={10}
                          fontWeight="black"
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={10}
                          fontWeight="black"
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-2xl border-none text-[10px] space-y-1 font-black uppercase tracking-widest">
                                  <p className="text-blue-400 mb-1">
                                    {payload[0].payload.name}
                                  </p>
                                  <p>
                                    单次消耗: {payload[0].payload.balls} 咕噜球
                                  </p>
                                  <p>
                                    清理污染: {payload[0].payload.pollution} 次
                                  </p>
                                  <p className="text-blue-400 pt-1 border-t border-white/10">
                                    效率指数: {payload[0].value}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="avg"
                          stroke="#2563eb"
                          strokeWidth={6}
                          dot={{
                            r: 8,
                            fill: "#2563eb",
                            strokeWidth: 4,
                            stroke: "#fff",
                          }}
                          activeDot={{ r: 10 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100 flex flex-col items-center">
                      <TrendingDown
                        size={20}
                        className="text-emerald-600 mb-2"
                      />
                      <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">
                        历史最佳效能
                      </p>
                      <p className="text-2xl font-black text-emerald-600">
                        {Math.min(...chartData.map((d) => d.avg))}
                      </p>
                    </div>
                    <div className="bg-red-50/50 p-6 rounded-[2rem] border border-red-100 flex flex-col items-center">
                      <ShieldAlert size={20} className="text-red-600 mb-2" />
                      <p className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-1">
                        最差效能记录
                      </p>
                      <p className="text-2xl font-black text-red-600">
                        {Math.max(...chartData.map((d) => d.avg))}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">
                      原始清理明细 (支持修正)
                    </p>
                    <div className="space-y-3">
                      {hunt.history.map((session, idx) => (
                        <div
                          key={session.id}
                          className="bg-white border border-slate-100 rounded-[1.5rem] p-5"
                        >
                          {editingSessionId === session.id ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">
                                    该次污染数
                                  </label>
                                  <input
                                    type="number"
                                    value={editSessionPollution}
                                    onChange={(e) =>
                                      setEditSessionPollution(
                                        Number(e.target.value),
                                      )
                                    }
                                    className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">
                                    该次消耗球数
                                  </label>
                                  <input
                                    type="number"
                                    value={editSessionBallsUsed}
                                    onChange={(e) =>
                                      setEditSessionBallsUsed(
                                        Number(e.target.value),
                                      )
                                    }
                                    className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => updateSession(session.id)}
                                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase"
                                >
                                  保存修正
                                </button>
                                <button
                                  onClick={() => setEditingSessionId(null)}
                                  className="px-6 bg-slate-100 text-slate-400 rounded-xl"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="text-xs font-black text-slate-300 w-8">
                                  #{idx + 1}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-slate-900">
                                    清理{" "}
                                    <span className="text-blue-600">
                                      {session.pollutionDiff}
                                    </span>{" "}
                                    次污染
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">
                                    消耗 {session.ballsUsed} 咕噜球 · 平均{" "}
                                    {(
                                      session.ballsUsed / session.pollutionDiff
                                    ).toFixed(1)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEditingSessionId(session.id);
                                    setEditSessionPollution(
                                      session.pollutionDiff,
                                    );
                                    setEditSessionBallsUsed(session.ballsUsed);
                                  }}
                                  className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                  title="编辑记录"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    deleteSession(session.id);
                                  }}
                                  className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all group/del flex items-center justify-center"
                                  title="移除此条记录"
                                >
                                  <Trash2
                                    size={18}
                                    className="group-hover/del:scale-110 transition-transform"
                                  />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
