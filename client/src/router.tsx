import { createBrowserRouter, Navigate } from "react-router";
import Home from "./routes/Home";
import Login from "./routes/Login";
import Register from "./routes/Register";
import VerifyEmail from "./routes/VerifyEmail";
import ResetPassword from "./routes/ResetPassword";
import Logout from "./routes/Logout";
import History from "./routes/History";
import AccountSettings from "./routes/AccountSettings";
import Feedback from "./routes/Feedback";
import Users from "./routes/Users";
import RequireAuth from "./auth/RequireAuth";
import NotFoundRedirect from "./routes/NotFoundRedirect";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/home" replace /> },
  { path: "/home", element: <Home /> },
  { path: "/history", element: <History /> },
  { path: "/feedback", element: <Feedback /> },
  { path: "/account-settings", element: <RequireAuth><AccountSettings /></RequireAuth> },
  { path: "/users", element: <RequireAuth><Users /></RequireAuth> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/verify-email", element: <VerifyEmail /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/logout", element: <Logout /> },
  { path: "*", element: <NotFoundRedirect /> },
]);
