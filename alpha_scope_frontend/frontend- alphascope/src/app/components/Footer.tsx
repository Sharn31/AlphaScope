import { useTheme } from "../context/ThemeContext";
import { ExternalLink } from "lucide-react";

interface FooterProps {
  onOpenChat?: () => void;
}

export default function Footer({ onOpenChat }: FooterProps) {
  const { isDarkMode } = useTheme();

  const borderColor = isDarkMode ? "border-slate-800"  : "border-slate-200";
  const bgColor     = isDarkMode ? "bg-slate-950"      : "bg-white";
  const textMuted   = isDarkMode ? "text-slate-500"    : "text-slate-400";

  return (
    <footer className={`border-t ${borderColor} ${bgColor} py-5 px-6 mt-auto`}>
      <div className="max-w-screen-2xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

          {/* Copyright & Disclaimer */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <p className={`text-sm ${textMuted}`}>
              © {new Date().getFullYear()} AlphaScope. Developed by{" "}
              <a
                href="https://www.linkedin.com/in/sharndeep-kaur-/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 transition-colors"
              >
                Sharndeep Kaur
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
            <p className={`text-xs ${textMuted} mt-1`}>
              Investment involves risk.
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
}