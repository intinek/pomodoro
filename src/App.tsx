import { useState, useEffect, useCallback, useRef } from 'react';

type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

interface Settings {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
}

interface DailyStats {
  date: string;
  completedPomodoros: number;
  totalFocusMinutes: number;
  sessions: { startTime: number; duration: number }[];
}

const DEFAULT_SETTINGS: Settings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
};

const MODE_LABELS: Record<TimerMode, string> = {
  focus: 'Concentración',
  shortBreak: 'Descanso Corto',
  longBreak: 'Descanso Largo',
};

const MODE_COLORS: Record<TimerMode, { bg: string; ring: string; text: string; button: string; buttonHover: string }> = {
  focus: {
    bg: 'from-rose-50 to-orange-50',
    ring: 'stroke-rose-500',
    text: 'text-rose-700',
    button: 'bg-rose-500',
    buttonHover: 'hover:bg-rose-600',
  },
  shortBreak: {
    bg: 'from-emerald-50 to-teal-50',
    ring: 'stroke-emerald-500',
    text: 'text-emerald-700',
    button: 'bg-emerald-500',
    buttonHover: 'hover:bg-emerald-600',
  },
  longBreak: {
    bg: 'from-blue-50 to-indigo-50',
    ring: 'stroke-blue-500',
    text: 'text-blue-700',
    button: 'bg-blue-500',
    buttonHover: 'hover:bg-blue-600',
  },
};

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function loadStats(): DailyStats {
  const saved = localStorage.getItem('pomodoro-stats');
  if (saved) {
    const stats: DailyStats = JSON.parse(saved);
    if (stats.date === getTodayKey()) {
      return stats;
    }
  }
  return { date: getTodayKey(), completedPomodoros: 0, totalFocusMinutes: 0, sessions: [] };
}

function saveStats(stats: DailyStats) {
  localStorage.setItem('pomodoro-stats', JSON.stringify(stats));
}

function loadSettings(): Settings {
  const saved = localStorage.getItem('pomodoro-settings');
  if (saved) {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: Settings) {
  localStorage.setItem('pomodoro-settings', JSON.stringify(settings));
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(settings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<DailyStats>(loadStats);
  const [showSettings, setShowSettings] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  const totalTime = mode === 'focus' ? settings.focusDuration * 60
    : mode === 'shortBreak' ? settings.shortBreakDuration * 60
    : settings.longBreakDuration * 60;

  const progress = (totalTime - timeLeft) / totalTime;

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      if (mode === 'focus' && !sessionStartRef.current) {
        sessionStartRef.current = Date.now();
      }
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const handleTimerComplete = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (mode === 'focus') {
      const newCount = pomodoroCount + 1;
      setPomodoroCount(newCount);

      const sessionDuration = settings.focusDuration;
      const newStats = {
        ...stats,
        completedPomodoros: stats.completedPomodoros + 1,
        totalFocusMinutes: stats.totalFocusMinutes + sessionDuration,
        sessions: [...stats.sessions, { startTime: sessionStartRef.current || Date.now(), duration: sessionDuration }],
      };
      setStats(newStats);
      saveStats(newStats);

      // Determine next break
      if (newCount % settings.longBreakInterval === 0) {
        setMode('longBreak');
        setTimeLeft(settings.longBreakDuration * 60);
      } else {
        setMode('shortBreak');
        setTimeLeft(settings.shortBreakDuration * 60);
      }
    } else {
      // Break finished, go back to focus
      setMode('focus');
      setTimeLeft(settings.focusDuration * 60);
    }
    sessionStartRef.current = null;
  }, [mode, pomodoroCount, stats, settings]);

  const handleStart = () => {
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    sessionStartRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimeLeft(totalTime);
  };

  const handleModeChange = (newMode: TimerMode) => {
    setIsRunning(false);
    sessionStartRef.current = null;
    setMode(newMode);
    const duration = newMode === 'focus' ? settings.focusDuration
      : newMode === 'shortBreak' ? settings.shortBreakDuration
      : settings.longBreakDuration;
    setTimeLeft(duration * 60);
  };

  const handleSettingsSave = (newSettings: Settings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    if (!isRunning) {
      const duration = mode === 'focus' ? newSettings.focusDuration
        : mode === 'shortBreak' ? newSettings.shortBreakDuration
        : newSettings.longBreakDuration;
      setTimeLeft(duration * 60);
    }
  };

  const handleResetStats = () => {
    const newStats = { date: getTodayKey(), completedPomodoros: 0, totalFocusMinutes: 0, sessions: [] };
    setStats(newStats);
    setPomodoroCount(0);
    saveStats(newStats);
  };

  const colors = MODE_COLORS[mode];
  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${colors.bg} transition-all duration-700 flex flex-col`}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍅</span>
          <h1 className="text-xl font-bold text-gray-800">Pomodoro Focus</h1>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-lg hover:bg-white/50 transition-colors text-gray-600"
          title="Configuración"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        {/* Mode Tabs */}
        <div className="flex gap-2 mb-8 bg-white/60 backdrop-blur-sm rounded-xl p-1.5 shadow-sm">
          {(Object.keys(MODE_LABELS) as TimerMode[]).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === m
                  ? `${MODE_COLORS[m].button} text-white shadow-md`
                  : 'text-gray-600 hover:bg-white/80'
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Timer Circle */}
        <div className="relative mb-8">
          <svg width="280" height="280" className="transform -rotate-90">
            <circle
              cx="140"
              cy="140"
              r="120"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            <circle
              cx="140"
              cy="140"
              r="120"
              fill="none"
              className={`${colors.ring} transition-all duration-1000`}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-sm font-medium ${colors.text} mb-1`}>
              {MODE_LABELS[mode]}
            </span>
            <span className="text-5xl font-bold text-gray-800 tabular-nums">
              {formatTime(timeLeft)}
            </span>
            <span className="text-xs text-gray-500 mt-2">
              {pomodoroCount % settings.longBreakInterval}/{settings.longBreakInterval} pomodoros
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-10">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className={`${colors.button} ${colors.buttonHover} text-white px-8 py-3 rounded-xl font-semibold text-lg shadow-lg transition-all transform hover:scale-105 active:scale-95`}
            >
              ▶ Iniciar
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-xl font-semibold text-lg shadow-lg transition-all transform hover:scale-105 active:scale-95"
            >
              ⏸ Pausar
            </button>
          )}
          <button
            onClick={handleReset}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 active:scale-95"
          >
            ↺ Reiniciar
          </button>
        </div>

        {/* Statistics */}
        <div className="w-full max-w-md bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">📊 Estadísticas de Hoy</h2>
            <button
              onClick={handleResetStats}
              className="text-xs text-gray-500 hover:text-red-500 transition-colors"
              title="Reiniciar estadísticas"
            >
              Reiniciar
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-rose-600">{stats.completedPomodoros}</div>
              <div className="text-xs text-gray-500 mt-1">Pomodoros</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600">{stats.totalFocusMinutes}</div>
              <div className="text-xs text-gray-500 mt-1">Minutos</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {Math.floor(stats.totalFocusMinutes / 60)}h {stats.totalFocusMinutes % 60}m
              </div>
              <div className="text-xs text-gray-500 mt-1">Tiempo Total</div>
            </div>
          </div>

          {/* Progress bar for daily goal (8 pomodoros) */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Meta diaria</span>
              <span>{stats.completedPomodoros}/8 pomodoros</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-rose-400 to-orange-400 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((stats.completedPomodoros / 8) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSettingsSave}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

interface SettingsModalProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">⚙️ Configuración</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              🍅 Duración de Concentración (minutos)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={localSettings.focusDuration}
              onChange={(e) => setLocalSettings({ ...localSettings, focusDuration: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ☕ Descanso Corto (minutos)
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={localSettings.shortBreakDuration}
              onChange={(e) => setLocalSettings({ ...localSettings, shortBreakDuration: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              🌴 Descanso Largo (minutos)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={localSettings.longBreakDuration}
              onChange={(e) => setLocalSettings({ ...localSettings, longBreakDuration: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              🔄 Pomodoros antes del Descanso Largo
            </label>
            <input
              type="number"
              min="2"
              max="10"
              value={localSettings.longBreakInterval}
              onChange={(e) => setLocalSettings({ ...localSettings, longBreakInterval: Math.max(2, parseInt(e.target.value) || 2) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-medium shadow-md transition"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
