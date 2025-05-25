import { createHashRouter, RouterProvider } from "react-router-dom";
import MainPage from "./main";
import PopularBooks from "../components/PopularBooks";
import NewUploads from "../components/NewUploads";
import SearchResults from "../components/SearchResults";
import Favorites from "../components/Favorites";
import BookPage from "../components/BookPage";

function App() {
  const router = createHashRouter([
    {
      path: "/",
      element: <MainPage />,
      children: [
        {
          index: true,
          element: <PopularBooks />,
        },
        {
          path: "new",
          element: <NewUploads />,
        },
        {
          path: "search",
          element: <SearchResults />,
        },
        {
          path: "favorites",
          element: <Favorites />,
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
      <RouterProvider router={router} />
    </div>
  );
}

export default App;