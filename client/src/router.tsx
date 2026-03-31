import { createBrowserRouter, Navigate } from "react-router";
import Home from "./routes/Home";
import History from "./routes/History";
import Feedback from "./routes/Feedback";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/home" replace /> },
  { path: "/home", element: <Home /> },
  { path: "/history", element: <History /> },
  { path: "/feedback", element: <Feedback /> },
  { path: "*", element: <Navigate to="/home" replace /> },
]);
