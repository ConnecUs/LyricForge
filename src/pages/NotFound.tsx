import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center animate-float-in">
        <div className="w-16 h-16 rounded-2xl glass-panel border border-[hsl(var(--hud-blue)/0.3)] flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
          <Layers className="w-8 h-8 text-[hsl(var(--hud-blue))]" />
        </div>
        <div className="text-6xl font-black text-white hud-glow-text mb-2">404</div>
        <p className="text-sm font-mono text-[hsl(var(--muted-foreground))] mb-1">
          ROUTE NOT FOUND: <span className="text-[hsl(var(--hud-magenta))]">{location.pathname}</span>
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground)/0.6)] mb-6">This sector of the HUD does not exist.</p>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-[hsl(var(--hud-blue))] text-white text-sm font-semibold hover:bg-[hsl(213,95%,45%)] transition-all"
          style={{ boxShadow: '0 0 20px hsl(213,95%,50%,0.4)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Studio
        </button>
      </div>
    </div>
  );
};

export default NotFound;
