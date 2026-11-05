import { useState } from "react";
import labIllustration from "../../assets/lab-illustration.png";
import logoIcon from "../../assets/logo-icon.png";
import { login } from "../../services/api";
import type { SessionUser } from "../../services/session";

interface LoginProps {
  onLogin: (user: SessionUser) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const user = username.trim();
    if (!user || !password) {
      setError("Escribe tu usuario y tu contraseña.");
      return;
    }

    setLoading(true);
    try {
      onLogin(await login(user, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#D6E4F0" }}>
      {/* Left column — illustration */}
      <div
        className="hidden lg:flex flex-1 items-center justify-center overflow-hidden"
        style={{ background: "#C9D9E8" }}
      >
        <img
          src={labIllustration}
          alt="Científica de laboratorio clínico"
          className="w-full h-full object-cover"
          style={{ maxHeight: "100vh" }}
        />
      </div>

      {/* Right column — login form */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div
          className="w-full max-w-sm rounded-2xl p-8 shadow-lg"
          style={{ background: "#FFFFFF" }}
        >
          {/* Logo circle */}
          <div className="flex justify-center mb-4">
            <div
              className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
              style={{ background: "#EFF6FF", border: "2px solid #BFDBFE" }}
            >
              <img
                src={logoIcon}
                alt="BioLab logo"
                className="w-full h-full object-contain"
                style={{ padding: 4 }}
              />
            </div>
          </div>

          <div className="text-center mb-7">
            <h1 className="text-xl font-bold" style={{ color: "#1E293B" }}>
              BioLab: Login
            </h1>
            <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
              Acceso para Personal Autorizado
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* Username */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl border"
              style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                type="text"
                placeholder="Usuario"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "#1E293B" }}
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl border"
              style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "#1E293B" }}
                autoComplete="current-password"
              />
            </div>

            {/* Error message */}
            {error && (
              <p className="text-xs px-1" style={{ color: "#EF4444" }}>
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white mt-1 transition-all disabled:opacity-60"
              style={{ background: "#3B82F6" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2563EB")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#3B82F6")}
            >
              Acceder
            </button>
          </form>

          <p className="text-center text-xs mt-4" style={{ color: "#CBD5E1" }}>
            BioLab Sistema Clínico v2.1 · © 2024
          </p>
        </div>
      </div>
    </div>
  );
}
