import { ReactElement, useEffect, useState } from "react";
import {
  createHashRouter,
  RouterProvider,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import MainPage from "./main";
import SearchResults from "../components/SearchResults";
import BookPage from "../components/BookPage";
import { TagFilterProvider } from "../../context/TagFilterContext";

const LAST_LOCATION_KEY = "last_location";

function LocationTracker(): ReactElement | null {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fullPath = location.pathname + location.search;
    if (fullPath !== "/") { // Не сохраняем корневой путь
      localStorage.setItem(LAST_LOCATION_KEY, fullPath);
    }
  }, [location]);

  return null;
}

function App() {
  const [initialized, setInitialized] = useState(false);
  const [initialRoute, setInitialRoute] = useState(
    "/search?type=popular&sort=popular-week&page=1"
  );

  useEffect(() => {
    // Проверяем localStorage после монтирования компонента
    const savedLocation = localStorage.getItem(LAST_LOCATION_KEY);
    if (savedLocation) {
      setInitialRoute(savedLocation);
    }
    setInitialized(true);
  }, []);

  const router = createHashRouter([
    {
      path: "/",
      element: (
        <>
          <MainPage />
          <LocationTracker />
        </>
      ),
      children: [
        {
          index: true,
          element: initialized ? (
            <Navigate to={initialRoute} replace />
          ) : null,
        },
        {
          path: "search",
          element: <SearchResults />,
        },
        {
          path: "book/:id",
          element: <BookPage />,
        },
      ],
    },
  ]);

  if (!initialized) {
    return <div className="app-wrapper">Loading...</div>;
  }

  return (
    <div className="app-wrapper">
      <TagFilterProvider>
        <RouterProvider router={router} />
      </TagFilterProvider>
    </div>
  );
}

export default App;