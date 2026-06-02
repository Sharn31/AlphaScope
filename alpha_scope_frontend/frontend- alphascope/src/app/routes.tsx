import { createBrowserRouter } from "react-router-dom";
import Root from "./components/Root";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Portfolio from "./pages/Portfolio";
import Watchlist from "./pages/Watchlist";
import Trading from "./pages/Trading";
import Alerts from "./pages/Alerts";
import News from "./pages/News";
import AIAssistant from "./pages/Aiassistant ";
import Settings from "./pages/Settings";
import ProtectedRoute from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/signup",
    Component: Signup,
  },
  {
    // Forgot password — user enters their email
    path: "/forgot-password",
    Component: ForgotPassword,
  },
  {
    // ✅ Reset password — linked from the email
    // dj-rest-auth sends: /reset-password/<uid>/<token>/
    path: "/reset-password/:uid/:token",
    Component: ResetPassword,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Root />
      </ProtectedRoute>
    ),
    children: [
      { index: true,               Component: Dashboard   },
      { path: "portfolio",         Component: Portfolio   },
      { path: "watchlist",         Component: Watchlist   },
      { path: "trading",           Component: Trading     },
      { path: "alerts",            Component: Alerts      },
      { path: "news",              Component: News        },
      { path: "ai-assistant",      Component: AIAssistant },
      { path: "settings",          Component: Settings    },
    ],
  },
]);