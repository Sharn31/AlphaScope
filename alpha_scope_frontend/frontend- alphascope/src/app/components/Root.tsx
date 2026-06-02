import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";
import { Toaster } from "./ui/sonner";
import { useTheme } from "../context/ThemeContext";
import ChatbotWidget from "./ChatbotWidget";  // ✅ uncomment/add this

export default function Root() {
  const { isDarkMode } = useTheme();
  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? "bg-slate-950" : "bg-slate-50"}`}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
        <Footer />
      </div>
      <Toaster />
      
      <ChatbotWidget />  {/* ✅ add here — outside main, floats over everything */}
    </div>
  );
}