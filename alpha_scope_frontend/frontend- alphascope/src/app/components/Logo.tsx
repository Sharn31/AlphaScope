// components/Logo.tsx
interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export default function Logo({ size = "md", showText = true }: LogoProps) {
  const sizes = {
    sm: { container: "w-9 h-9", text: "text-xl" },
    md: { container: "w-11 h-11", text: "text-2xl" },
    lg: { container: "w-14 h-14", text: "text-3xl" },
  };

  const { container, text } = sizes[size];

  return (
    <div className="flex items-center gap-3">
      {/* Logo Icon */}
      <div className={`${container} rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30`}>
        <span className="text-white font-bold tracking-tighter text-3xl drop-shadow-md">A</span>
      </div>

      {/* Text */}
      {showText && (
        <div>
          <h1 className={`${text} font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent`}>
            AlphaScope
          </h1>
          <p className="text-[10px] text-slate-400 -mt-1">AI-Powered Trading</p>
        </div>
      )}
    </div>
  );
}