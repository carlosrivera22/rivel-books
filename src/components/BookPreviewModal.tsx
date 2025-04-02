import React, { useRef } from 'react';
import { Book as BookIcon, X } from "lucide-react";
import { Book } from '@/types/types';

interface BookPreviewModalProps {
    previewBook: Book;
    showPreview: boolean;
    closePreview: () => void;
    getEmbeddedPreviewUrl: (book: Book | null) => string | null;
}

export const BookPreviewModal: React.FC<BookPreviewModalProps> = ({
    previewBook,
    showPreview,
    closePreview,
    getEmbeddedPreviewUrl
}) => {
    const previewModalRef = useRef<HTMLDivElement | null>(null);

    if (!showPreview || !previewBook) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div
                ref={previewModalRef}
                className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-5/6 flex flex-col overflow-hidden"
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-indigo-50">
                    <div className="flex items-center">
                        <div className="w-10 h-14 bg-indigo-100 flex-shrink-0 rounded overflow-hidden mr-3 flex items-center justify-center">
                            {previewBook.coverId ? (
                                <img
                                    src={`https://covers.openlibrary.org/b/id/${previewBook.coverId}-S.jpg`}
                                    alt={previewBook.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <BookIcon className="w-6 h-6 text-indigo-400" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-semibold text-indigo-900 text-lg">{previewBook.title}</h3>
                            <p className="text-sm text-indigo-700">by {previewBook.author}</p>
                        </div>
                    </div>
                    <button
                        onClick={closePreview}
                        className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Modal Content - Iframe */}
                <div className="flex-1 w-full h-full overflow-hidden bg-gray-100">
                    <iframe
                        src={getEmbeddedPreviewUrl(previewBook) ?? "about:blank"}
                        title={`Preview of ${previewBook.title}`}
                        className="w-full h-full border-0"
                        allow="fullscreen"
                        loading="lazy"
                    ></iframe>
                </div>

                {/* Modal Footer */}
                <div className="p-3 bg-white border-t border-gray-200 flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                        <p className="font-semibold">Preview</p>
                        <p className="text-sm text-gray-500">Preview the book in a new window.</p>
                    </div>
                    <button
                        onClick={closePreview}
                        className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookPreviewModal;