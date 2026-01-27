import { createBrowserRouter, Navigate } from "react-router";
import Home from "./routes/Home";
import Login from "./routes/Login";
import Register from "./routes/Register";
import Logout from "./routes/Logout";
import RequireAuth from "./auth/RequireAuth";
import NotFoundRedirect from "./routes/NotFoundRedirect";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/home" replace /> },
  { path: "/home", element: <RequireAuth><Home /></RequireAuth> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/logout", element: <Logout /> },
  { path: "*", element: <NotFoundRedirect /> },
]);