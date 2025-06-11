import { useEffect, useState } from "react";

export interface Tag {
  id: number | string;
  type: string;
  name: string;
  url: string;
  count: number;
}

export interface TagsByCategory {
  tags: Tag[];
  artists: Tag[];
  characters: Tag[];
  parodies: Tag[];
  groups: Tag[];
  categories: Tag[];
  languages: Tag[];
}

export const useTags = (): TagsByCategory => {
  const [allTags, setAllTags] = useState<TagsByCategory>({
    tags: [],
    artists: [],
    characters: [],
    parodies: [],
    groups: [],
    categories: [],
    languages: [],
  });

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "get-tags" }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "tags-reply" && message.tags) {
        if (Array.isArray(message.tags) && message.tags.length > 0 && message.tags[0].type) {
          const grouped: TagsByCategory = {
            tags: [],
            artists: [],
            characters: [],
            parodies: [],
            groups: [],
            categories: [],
            languages: [],
          };
          message.tags.forEach((tag: Tag) => {
            const key = tag.type as keyof TagsByCategory;
            if (grouped[key]) grouped[key].push(tag);
          });
          setAllTags(grouped);
        } else {
          setAllTags(message.tags);
        }
      }
    };

    return () => ws.close();
  }, []);

  return allTags;
};
