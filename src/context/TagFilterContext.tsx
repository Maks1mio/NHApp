import React, { createContext, useContext, useEffect, useState } from "react";
import { Tag as ExternalTag  } from "../renderer/components/TagFilter/useTags";

// Переэкспортируем, чтобы внешние модули могли подхватить этот тип:
export type Tag = ExternalTag;

interface TagFilterContextProps {
  selectedTags: Tag[];
  setSelectedTags: (tags: Tag[]) => void;
  addTag: (tag: Tag) => void;
  removeTag: (tag: Tag) => void;
  clearTags: () => void;
}

const TagFilterContext = createContext<TagFilterContextProps>({
  selectedTags: [],
  setSelectedTags: () => {},
  addTag: () => {},
  removeTag: () => {},
  clearTags: () => {},
});

export const TagFilterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [selectedTags, setSelectedTags] = useState<Tag[]>(() => {
    try {
      const json = localStorage.getItem("globalTags");
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("globalTags", JSON.stringify(selectedTags));
  }, [selectedTags]);

  const addTag = (tag: Tag) => {
    setSelectedTags((prev) =>
      prev.some((t) => t.id === tag.id && t.type === tag.type) ? prev : [...prev, tag]
    );
  };
  const removeTag = (tag: Tag) => {
    setSelectedTags((prev) =>
      prev.filter((t) => !(t.id === tag.id && t.type === tag.type))
    );
  };
  const clearTags = () => setSelectedTags([]);

  return (
    <TagFilterContext.Provider
      value={{ selectedTags, setSelectedTags, addTag, removeTag, clearTags }}
    >
      {children}
    </TagFilterContext.Provider>
  );
};

export const useTagFilter = () => useContext(TagFilterContext);
