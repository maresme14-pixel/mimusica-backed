const express = require('express');
const cors = require('cors');
const ytSearch = require('yt-search');
const youtubedl = require('youtube-dl-exec');

const app = express();
app.use(cors());

const unfetch = require('isomorphic-unfetch');
const { getTracks, getData } = require('spotify-url-info')(unfetch);

app.get('/api/spotify', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('Falta la URL');
  try {
    const data = await getData(url);
    const tracks = await getTracks(url);
    const results = tracks.map(t => ({
      name: t.name,
      artist: t.artists && t.artists[0] ? t.artists[0].name : ''
    }));
    res.json({ name: data.name || 'Importada de Spotify', tracks: results });
  } catch (error) {
    console.error("Error scrapeando Spotify:", error.message);
    res.status(500).json({ error: 'No se pudo importar' });
  }
});

// Proxy para buscar en iTunes (evita bloqueos de Safari Móvil)
app.get('/api/search', async (req, res) => {
  const term = req.query.term;
  if (!term) return res.status(400).send('Falta el término de búsqueda');
  try {
    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=20`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error buscando en iTunes:", error.message);
    res.status(500).json({ error: 'Error interno en la búsqueda' });
  }
});

app.get('/api/stream', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).send('Falta la query');
  
  try {
    // 1. Buscar la canción
    const searchRes = await ytSearch(query);
    const firstVideo = searchRes.videos[0];
    if (!firstVideo) return res.status(404).send('No se encontró el video');
    
    // 2. Extraer la URL directa de audio con yt-dlp (youtube-dl-exec)
    const audioUrl = await youtubedl(firstVideo.url, {
      getUrl: true,
      extractAudio: true,
      format: 'bestaudio'
    });
    
    // 3. Redireccionar directamente a los servidores de Google/YouTube
    res.redirect(audioUrl);

  } catch (error) {
    console.error("Error al extraer URL:", error.message);
    if (!res.headersSent) res.status(500).send('Error interno en stream');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Servidor de música funcionando en el puerto ${PORT} con yt-dlp`);
  console.log(`Escuchando peticiones mágicas...`);
});
