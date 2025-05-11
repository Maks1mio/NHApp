import { createHashRouter, RouterProvider } from "react-router";
import MainPage from "./main";

function App() {
  const router = createHashRouter([
    {
      path: "/",
      element: <MainPage />,
    },
  ]);

  return (
    <div className="app-wrapper">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
