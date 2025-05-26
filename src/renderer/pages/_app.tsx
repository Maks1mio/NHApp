import {
  createHashRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";

import MainPage       from "./main";
import SearchResults  from "../components/SearchResults";
import BookPage       from "../components/BookPage";
import { TagFilterProvider } from "../../context/TagFilterContext";

function App() {
  const router = createHashRouter([
    {
      path: "/",
      element: <MainPage />,
      children: [
        {
          index: true,
          element: (
            <Navigate
              to="/search?type=popular&sort=popular-week"
              replace
            />
          ),
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

  return (
    <div className="app-wrapper">
      <TagFilterProvider>
        <RouterProvider router={router} />
      </TagFilterProvider>
    </div>
  );
}

export default App;
