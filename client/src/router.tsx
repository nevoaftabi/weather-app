import { createBrowserRouter, Navigate } from "react-router";
import Home from "./routes/Home";
import Login from "./routes/Login";
import Register from "./routes/Register";
import VerifyEmail from "./routes/VerifyEmail";
import Logout from "./routes/Logout";
import History from "./routes/History";
import RequireAuth from "./auth/RequireAuth";
import NotFoundRedirect from "./routes/NotFoundRedirect";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/home" replace /> },
  { path: "/home", element: <RequireAuth><Home /></RequireAuth> },
  { path: "/history", element: <RequireAuth><History /></RequireAuth> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/verify-email", element: <VerifyEmail /> },
  { path: "/logout", element: <Logout /> },
  { path: "*", element: <NotFoundRedirect /> },
]);
