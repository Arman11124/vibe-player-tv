export const fetchRatings = async (imdbId: string) => {
    try {
        const response = await fetch(`http://www.omdbapi.com/?i=${imdbId}&apikey=trilogy`);
        const data = await response.json();
        return data.Ratings || [];
    } catch (e) {
        console.warn('[OMDb] Failed', e);
        return [];
    }
};
