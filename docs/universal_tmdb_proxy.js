export default {
    async fetch(request) {
        const url = new URL(request.url);
        const path = url.pathname;

        // ОПРЕДЕЛЯЕМ ЦЕЛЬ (Target)
        let targetDomain = '';

        // Если запрос начинается с /t/p/ - это картинка
        if (path.startsWith('/t/p/')) {
            targetDomain = 'image.tmdb.org';
        }
        // В остальных случаях считаем, что это API запрос
        else {
            targetDomain = 'api.themoviedb.org';
        }

        // Формируем новый URL
        const newUrl = new URL(request.url);
        newUrl.hostname = targetDomain;
        newUrl.protocol = 'https:';

        // Создаем новый запрос с правильными заголовками
        // ВАЖНО: Мы должны подменить Host, иначе TMDB отклонит запрос
        const newRequest = new Request(newUrl, {
            method: request.method,
            headers: request.headers,
            body: request.body
        });

        // Устанавливаем правильный Host header и Referer
        newRequest.headers.set('Host', targetDomain);
        newRequest.headers.set('Referer', `https://${targetDomain}`);

        // Выполняем запрос
        const response = await fetch(newRequest);

        // Добавляем CORS заголовки, чтобы ваше Android/Web приложение могло читать ответ
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

        return newResponse;
    }
};
