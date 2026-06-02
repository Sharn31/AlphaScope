import { createContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: number;
  email: string;
  name: string;
  username?: string;
}

interface AuthContextType {
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem("jwt_token");
      const savedUser = localStorage.getItem("user");
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch {
      localStorage.removeItem("jwt_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("http://127.0.0.1:8000/accounts/login/", {  // ✅ fixed
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: email,
        password,
      }),
    });

    if (!res.ok) throw new Error("Invalid credentials");

    const data = await res.json();

    if (data.access_token) {
      localStorage.setItem("jwt_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("user", JSON.stringify({
        id: data.user_id,
        email: email,
        name: data.username,
      }));
      setToken(data.access_token);
      setUser({ id: data.user_id, email: email, name: data.username });
    } else {
      throw new Error("Invalid credentials");
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    const res = await fetch("http://127.0.0.1:8000/accounts/signup/", {  // ✅ fixed
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: name,
        email: email,
        password: password,
      }),
    });

    if (!res.ok) throw new Error("Signup failed");

    const data = await res.json();
    if (data.message !== "User Created Successfully") {
      throw new Error("Signup failed");
    }
  };

  const logout = () => {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      login,
      signup,
      logout,
      token,
      user,
      isAuthenticated: !!token,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}