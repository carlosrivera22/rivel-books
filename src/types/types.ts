// types.ts
export type Book = {
    id: string;
    title: string;
    author: string;
    year: string | number;
    coverId: number | null;
    publisher: string;
    languages: string[];
    isbn: string | null;
    hasFulltext: boolean;
    iaIdentifier: string | null;
    previewAvailable: boolean;
    previewUrl: string | null;
    readUrl: string | null;
    readable?: boolean;
}