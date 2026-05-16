import fs from "fs";
import path from "path";
import matter from "gray-matter";

const editionsDir = path.join(process.cwd(), "content/editions");

export interface Edition {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  storyImages: string[];
}

export function getAllEditions(): Edition[] {
  const files = fs.readdirSync(editionsDir).filter((f) => f.endsWith(".md"));
  const editions = files.map((file) => {
    const raw = fs.readFileSync(path.join(editionsDir, file), "utf-8");
    const { data, content } = matter(raw);
    const storyImages: string[] = Array.isArray(data.story_images) ? data.story_images : [];
    return {
      slug: data.slug as string,
      title: data.title as string,
      date: data.date as string,
      excerpt: data.excerpt as string,
      content,
      storyImages,
      coverImage: storyImages[0] ?? undefined,
    };
  });
  return editions.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getEditionBySlug(slug: string): Edition | undefined {
  return getAllEditions().find((e) => e.slug === slug);
}
