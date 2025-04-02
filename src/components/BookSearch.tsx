import React, { useState, useEffect, useRef } from 'react';
import { Search, Book as BookIcon, X, Loader2, BookOpen, Calendar, User, Filter, Eye, Download } from 'lucide-react';
import BookPreviewModal from './BookPreviewModal';
import { Book } from '@/types/types';

// Interface for advanced filters
interface AdvancedFilters {
    author: string;
    subject: string;
    year: string;
    availability: 'all' | 'preview' | 'fulltext';
}

// Interface for OpenLibrary API response
interface OpenLibrarySearchResponse {
    numFound: number;
    start: number;
    docs: OpenLibraryBook[];
}

interface OpenLibraryBook {
    key: string;
    title: string;
    author_name?: string[];
    first_publish_year?: number;
    cover_i?: number;
    publisher?: string[];
    language?: string[];
    isbn?: string[];
    has_fulltext: boolean;
    ia?: string[];
}

interface BookPreviewData {
    [key: string]: {
        preview_url?: string;
        borrow_url?: string;
    };
}

const BookSearch: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<Book[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
    const [totalResults, setTotalResults] = useState<number>(0);
    const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
        author: '',
        subject: '',
        year: '',
        availability: 'all' // 'all', 'preview', 'fulltext'
    });
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
    const [searchMode, setSearchMode] = useState<'button' | 'debounce'>('button'); // 'button' or 'debounce'
    const [previewBook, setPreviewBook] = useState<Book | null>(null); // For the preview modal
    const [showPreview, setShowPreview] = useState<boolean>(false);
    const previewModalRef = useRef<HTMLDivElement | null>(null);

    // Handle clicks outside the modal to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (previewModalRef.current && !previewModalRef.current.contains(event.target as Node)) {
                setShowPreview(false);
            }
        };

        // Add event listener when modal is shown
        if (showPreview) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        // Cleanup
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showPreview]);

    // Prevent body scrolling when modal is open
    useEffect(() => {
        if (showPreview) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }

        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [showPreview]);

    // Set up debounce effect for search
    useEffect(() => {
        // Only apply debouncing if we're in debounce mode
        if (searchMode === 'debounce') {
            const timer = setTimeout(() => {
                if (searchQuery) {
                    setDebouncedSearchTerm(searchQuery);
                }
            }, 500); // 500ms delay

            return () => clearTimeout(timer);
        }
    }, [searchQuery, searchMode]);

    // Effect to trigger search when debounced term changes
    useEffect(() => {
        if (debouncedSearchTerm && searchMode === 'debounce') {
            searchBooks(debouncedSearchTerm, advancedFilters);
        }
    }, [debouncedSearchTerm, advancedFilters]);

    const searchBooks = async (query: string, filters: AdvancedFilters = advancedFilters) => {
        if (!query && !filters.author && !filters.subject && !filters.year && filters.availability === 'all') return;

        setLoading(true);
        setError(null);

        try {
            // Build the query string with filters
            let queryString = query;
            if (filters.author) queryString += ` author:${filters.author}`;
            if (filters.subject) queryString += ` subject:${filters.subject}`;
            if (filters.year) queryString += ` publishdate:${filters.year}`;

            // Add availability filter to API URL
            let apiUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(queryString)}&limit=20`;

            // Add has_fulltext parameter based on availability filter
            if (filters.availability === 'fulltext') {
                apiUrl += '&has_fulltext=true';
            }

            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error('Failed to fetch search results');
            }

            const data: OpenLibrarySearchResponse = await response.json();

            // Get basic book information first
            let processedResults: Book[] = data.docs.map((book: OpenLibraryBook) => ({
                id: book.key,
                title: book.title,
                author: book.author_name ? book.author_name[0] : 'Unknown Author',
                year: book.first_publish_year || 'Unknown Year',
                coverId: book.cover_i || null,
                publisher: book.publisher ? book.publisher[0] : 'Unknown Publisher',
                languages: book.language ? book.language.map((lang: string) => {
                    const langMap: { [key: string]: string } = { 'eng': 'English', 'fre': 'French', 'spa': 'Spanish', 'ger': 'German', 'ita': 'Italian' };
                    return langMap[lang] || lang;
                }) : ['Unknown'],
                isbn: book.isbn ? book.isbn[0] : null,
                hasFulltext: book.has_fulltext === true,
                iaIdentifier: book.ia ? book.ia[0] : null,
                previewAvailable: false,
                previewUrl: null,
                readUrl: null
            }));

            // For preview availability, we need to check books API
            // This is more efficient than checking every book - only check first 20
            const booksWithIsbn = processedResults.filter(book => book.isbn);
            if (booksWithIsbn.length > 0) {
                // Create batches of 10 ISBNs to reduce API calls
                const batchSize = 10;
                const batches: Book[][] = [];

                for (let i = 0; i < booksWithIsbn.length; i += batchSize) {
                    batches.push(booksWithIsbn.slice(i, i + batchSize));
                }

                // Process each batch
                for (const batch of batches) {
                    const bibkeys = batch.map(book => `ISBN:${book.isbn}`).join(',');
                    const previewResponse = await fetch(
                        `https://openlibrary.org/api/books?bibkeys=${bibkeys}&format=json&jscmd=viewapi`
                    );

                    if (previewResponse.ok) {
                        const previewData: BookPreviewData = await previewResponse.json();

                        // Update book data with preview information
                        processedResults = processedResults.map(book => {
                            if (book.isbn) {
                                const bibkey = `ISBN:${book.isbn}`;
                                if (previewData[bibkey]) {
                                    const info = previewData[bibkey];
                                    return {
                                        ...book,
                                        previewAvailable: !!info.preview_url,
                                        previewUrl: info.preview_url || null,
                                        // If we have borrow info, this is likely borrowable/readable
                                        readable: !!info.borrow_url,
                                        readUrl: info.borrow_url || info.preview_url || null
                                    };
                                }
                            }
                            return book;
                        });
                    }
                }
            }

            // Handle Internet Archive identifiers for books without ISBN but with IA ID
            const booksWithIaOnly = processedResults.filter(book => !book.previewAvailable && book.iaIdentifier);
            for (const book of booksWithIaOnly) {
                processedResults = processedResults.map(item => {
                    if (item.id === book.id) {
                        return {
                            ...item,
                            previewAvailable: true,
                            previewUrl: `https://archive.org/details/${book.iaIdentifier}`,
                            readUrl: `https://archive.org/details/${book.iaIdentifier}`
                        };
                    }
                    return item;
                });
            }

            // Filter results based on availability if needed
            if (filters.availability === 'preview') {
                processedResults = processedResults.filter(book => book.previewAvailable);
            } else if (filters.availability === 'fulltext') {
                processedResults = processedResults.filter(book => book.hasFulltext);
            }

            setSearchResults(processedResults);
            setTotalResults(
                filters.availability === 'all' ? data.numFound : processedResults.length
            );
        } catch (err: any) {
            console.error('Error searching books:', err);
            setError(err.message);
            setSearchResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery) {
            searchBooks(searchQuery, advancedFilters);
        }
    };

    const clearSearch = () => {
        setSearchQuery('');
        setDebouncedSearchTerm('');
        setSearchResults([]);
        setAdvancedFilters({
            author: '',
            subject: '',
            year: '',
            availability: 'all'
        });
    };

    // Open preview modal for a book
    const openPreview = (book: Book) => {
        setPreviewBook(book);
        setShowPreview(true);
    };

    // Close preview modal
    const closePreview = () => {
        setShowPreview(false);
        setPreviewBook(null);
    };

    const toggleSearchMode = () => {
        setSearchMode(prevMode => prevMode === 'button' ? 'debounce' : 'button');
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setAdvancedFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Get embedded preview URL
    const getEmbeddedPreviewUrl = (book: Book | null): string | null => {
        if (!book || !book.previewUrl) return null;

        // Handle Internet Archive URLs
        if (book.previewUrl.includes('archive.org')) {
            return book.previewUrl.replace('/details/', '/embed/');
        }

        // Handle Open Library URLs - direct to preview if possible
        if (book.previewUrl.includes('openlibrary.org')) {
            return book.previewUrl;
        }

        // Handle Google Books URLs
        if (book.previewUrl.includes('books.google.com')) {
            const url = new URL(book.previewUrl);
            const id = url.searchParams.get('id');
            if (id) {
                return `https://www.google.com/books/edition/_/${id}?hl=en&gbpv=0&gboembed=true`;
            }
        }

        return book.previewUrl;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-sky-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white backdrop-blur-lg bg-opacity-90 p-8 rounded-2xl shadow-lg border border-indigo-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent flex items-center">
                            <Search className="w-6 h-6 mr-2 text-indigo-600" />
                            Book Search Explorer
                        </h2>
                        <div className="mt-4 md:mt-0 flex space-x-3">
                            <button
                                onClick={toggleSearchMode}
                                className={`px-4 py-2 rounded-full text-sm flex items-center transition-colors ${searchMode === 'debounce'
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                    }`}
                            >
                                <span>{searchMode === 'debounce' ? 'Auto Search' : 'Manual Search'}</span>
                            </button>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="px-4 py-2 bg-indigo-50 rounded-full text-sm text-indigo-700 flex items-center hover:bg-indigo-100 transition-colors"
                            >
                                <Filter className="w-4 h-4 mr-1" />
                                <span>{showFilters ? 'Hide Filters' : 'Advanced Filters'}</span>
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSearchSubmit} className="mb-6">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={`Search by title, author, subject... ${searchMode === 'debounce' ? '(auto-search)' : ''}`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-5 py-4 pr-12 text-gray-700 bg-indigo-50 border border-indigo-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={clearSearch}
                                        className="p-1 hover:bg-indigo-100 rounded-full mr-1"
                                    >
                                        <X className="h-5 w-5 text-indigo-400 hover:text-indigo-600" />
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className={`p-1 hover:bg-indigo-100 rounded-full ${searchMode === 'button' ? '' : 'opacity-50'}`}
                                    disabled={searchMode === 'debounce'}
                                    title={searchMode === 'debounce' ? "Auto-search is enabled" : "Search"}
                                >
                                    <Search className="h-5 w-5 text-indigo-600" />
                                </button>
                            </div>
                        </div>

                        {showFilters && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-indigo-50 rounded-xl">
                                <div>
                                    <label className="block text-sm font-medium text-indigo-700 mb-1">Author</label>
                                    <input
                                        type="text"
                                        name="author"
                                        value={advancedFilters.author}
                                        onChange={handleFilterChange}
                                        placeholder="Author name"
                                        className="w-full px-3 py-2 text-gray-700 bg-white border border-indigo-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-indigo-700 mb-1">Subject</label>
                                    <input
                                        type="text"
                                        name="subject"
                                        value={advancedFilters.subject}
                                        onChange={handleFilterChange}
                                        placeholder="e.g. fantasy, history"
                                        className="w-full px-3 py-2 text-gray-700 bg-white border border-indigo-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-indigo-700 mb-1">Publish Year</label>
                                    <input
                                        type="text"
                                        name="year"
                                        value={advancedFilters.year}
                                        onChange={handleFilterChange}
                                        placeholder="e.g. 2020"
                                        className="w-full px-3 py-2 text-gray-700 bg-white border border-indigo-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-indigo-700 mb-1">Availability</label>
                                    <select
                                        name="availability"
                                        value={advancedFilters.availability}
                                        onChange={handleFilterChange}
                                        className="w-full px-3 py-2 text-gray-700 bg-white border border-indigo-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="all">All Books</option>
                                        <option value="preview">Has Preview</option>
                                        <option value="fulltext">Full Text</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </form>

                    {loading && (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                            <span className="ml-3 text-indigo-700">Searching books...</span>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
                            <p className="font-medium">Error: {error}</p>
                            <p className="mt-1 text-sm">Please try again or modify your search.</p>
                        </div>
                    )}

                    {!loading && searchResults.length > 0 && (
                        <>
                            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between">
                                <p className="text-indigo-700 font-medium mb-2 sm:mb-0">
                                    Found <span className="font-bold">{totalResults.toLocaleString()}</span> books
                                    {searchQuery && <span> matching "<strong>{searchQuery}</strong>"</span>}
                                    {advancedFilters.availability === 'preview' && <span> with <strong>previews</strong></span>}
                                    {advancedFilters.availability === 'fulltext' && <span> with <strong>full text</strong></span>}
                                </p>

                            </div>

                            <div className="space-y-4">
                                {searchResults.map(book => (
                                    <div
                                        key={book.id}
                                        className={`p-4 rounded-xl border transition-all ${selectedBooks.includes(book.id)
                                            ? 'border-indigo-400 bg-indigo-50 shadow-md'
                                            : 'border-gray-200 bg-white hover:border-indigo-200 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="flex items-start">
                                            <div className="flex-shrink-0 mr-4">
                                                {book.coverId ? (
                                                    <img
                                                        src={`https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`}
                                                        alt={`Cover for ${book.title}`}
                                                        className="w-24 h-32 object-cover rounded-md shadow-sm"
                                                    />
                                                ) : (
                                                    <div className="w-24 h-32 bg-indigo-100 flex items-center justify-center rounded-md">
                                                        <BookIcon className="w-8 h-8 text-indigo-400" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-start justify-between">
                                                    <h3 className="text-lg font-semibold text-indigo-900">{book.title}</h3>
                                                    <div className="flex items-center space-x-2">
                                                        {book.previewAvailable && (
                                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                                                Preview
                                                            </span>
                                                        )}
                                                        {book.hasFulltext && (
                                                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                                                Full Text
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-1 flex flex-wrap items-center text-sm text-gray-600">
                                                    <span className="flex items-center mr-4 mb-1">
                                                        <User className="w-4 h-4 mr-1 text-indigo-500" />
                                                        {book.author}
                                                    </span>
                                                    <span className="flex items-center mr-4 mb-1">
                                                        <Calendar className="w-4 h-4 mr-1 text-indigo-500" />
                                                        {book.year}
                                                    </span>
                                                    <span className="flex items-center mb-1">
                                                        <BookOpen className="w-4 h-4 mr-1 text-indigo-500" />
                                                        {book.publisher}
                                                    </span>
                                                </div>

                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    {book.languages.map((lang, i) => (
                                                        <span
                                                            key={i}
                                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                                                        >
                                                            {lang}
                                                        </span>
                                                    ))}
                                                </div>

                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    {book.previewAvailable && book.previewUrl && (
                                                        <button
                                                            onClick={() => openPreview(book)}
                                                            className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 text-xs rounded-lg hover:bg-blue-200 transition-colors"
                                                        >
                                                            <Eye className="w-3 h-3 mr-1" />
                                                            <span className="font-medium">Preview</span>
                                                        </button>
                                                    )}

                                                    {book.hasFulltext && (
                                                        <a
                                                            href={`https://openlibrary.org${book.id}/borrow`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-700 text-xs rounded-lg hover:bg-green-200 transition-colors"
                                                        >
                                                            <Download className="w-3 h-3 mr-1" />
                                                            <span className="font-medium">Read Full Text</span>
                                                        </a>
                                                    )}

                                                    <a
                                                        href={`https://openlibrary.org${book.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 transition-colors"
                                                    >
                                                        <BookIcon className="w-3 h-3 mr-1" />
                                                        <span className="font-medium">View Details</span>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* More information and links */}
                            <div className="mt-8 p-6 bg-indigo-50 rounded-xl border border-indigo-100">
                                <h3 className="text-lg font-medium text-indigo-800 mb-2">About Open Library</h3>
                                <p className="text-indigo-700 mb-4">
                                    Open Library is an open, editable library catalog, building towards a web page for every book ever published.
                                    Preview and full text availability is determined by copyright status, partnerships with publishers, and donations.
                                </p>
                                <p className="text-indigo-600 text-sm">
                                    Public domain books and classic literature are more likely to be available for preview or full reading.
                                </p>
                            </div>
                        </>
                    )}

                    {!loading && searchResults.length === 0 && (
                        <div className="text-center py-12 px-6">
                            <div className="w-20 h-20 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-6">
                                <Search className="w-10 h-10 text-indigo-500" />
                            </div>
                            <h3 className="text-xl font-medium text-gray-900 mb-2">Search for books</h3>
                            <p className="text-gray-600 max-w-xl mx-auto mb-4">
                                Use the search box above to find books by title, author, or subject.
                                {searchMode === 'debounce'
                                    ? " Results will appear automatically as you type."
                                    : " Press Enter or click the search icon when ready to search."
                                }
                            </p>
                            <p className="text-indigo-600 font-medium max-w-xl mx-auto mb-8">
                                Now with book previews and full-text availability! Use the "Availability" filter to find readable books.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
                                <div className="p-4 border border-indigo-100 rounded-lg bg-white">
                                    <h4 className="font-medium text-indigo-800 mb-1">Search by Title</h4>
                                    <p className="text-sm text-gray-600">Enter book titles like "Lord of the Rings" or "Pride and Prejudice"</p>
                                </div>
                                <div className="p-4 border border-indigo-100 rounded-lg bg-white">
                                    <h4 className="font-medium text-indigo-800 mb-1">Search by Author</h4>
                                    <p className="text-sm text-gray-600">Type author names or use the author filter for more precision</p>
                                </div>
                                <div className="p-4 border border-indigo-100 rounded-lg bg-white">
                                    <h4 className="font-medium text-indigo-800 mb-1">Filter by Subject</h4>
                                    <p className="text-sm text-gray-600">Narrow your search with subjects like "fantasy" or "biography"</p>
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                                <div className="p-5 border border-blue-100 rounded-lg bg-blue-50">
                                    <div className="flex items-start">
                                        <div className="p-2 bg-blue-100 rounded-full mr-3">
                                            <Eye className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-blue-800 mb-1">Book Previews</h4>
                                            <p className="text-sm text-blue-700">
                                                Many books offer preview sections that you can read online before purchasing or borrowing.
                                                Look for the "Preview" badge on search results.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5 border border-green-100 rounded-lg bg-green-50">
                                    <div className="flex items-start">
                                        <div className="p-2 bg-green-100 rounded-full mr-3">
                                            <BookOpen className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-green-800 mb-1">Full Text Books</h4>
                                            <p className="text-sm text-green-700">
                                                Some books are available to read in full for free. Classic literature and
                                                public domain books are most likely to have full text available.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {showPreview && previewBook && (
                <BookPreviewModal
                    previewBook={previewBook}
                    showPreview={showPreview}
                    closePreview={() => setShowPreview(false)}
                    getEmbeddedPreviewUrl={(book) => getEmbeddedPreviewUrl(book)}
                />
            )}
        </div>
    );
}

export default BookSearch;