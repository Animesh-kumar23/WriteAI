import { createBrowserRouter } from "react-router";
import { Outlet } from "react-router";
import {
  DocumentPage,
  DashboardPage,
  EditDocumentPage,
  ErrorPage,
  LandingPage,
  ProfilePage,
  SignInPage,
  SignUpPage,
} from "../pages";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";

const router = createBrowserRouter([
  {
    path: "/",
    // root error boundary catches all errors
    element: <Outlet />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: "register",
        element: (
          <PublicRoute>
            <SignUpPage />
          </PublicRoute>
        ),
      },
      {
        path: "login",
        element: (
          <PublicRoute>
            <SignInPage />
          </PublicRoute>
        ),
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "documents/:documentId",
        element: (
          <ProtectedRoute>
            <DocumentPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "documents/:documentId/edit",
        element: (
          <ProtectedRoute>
            <EditDocumentPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "profile",
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      // catch-all for 404s
      {
        path: "*",
        element: <ErrorPage />,
      },
    ],
  },
]);

export default router;
