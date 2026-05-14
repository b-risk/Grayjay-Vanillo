// Platform information
const platform = {
    title: 'Vanillo',
    url: 'https://vanillo.tv/',
    icon: 'https://vanillo.tv/vanillo192.png',
    banner: 'https://vanillo.tv/vanillo192.png',
    description: 'Video made simple.'
}

// API endpoints
const api = {
    base: 'https://api.vanillo.tv',
    frontend: 'https://vanillo.tv'
}

let config = {};
let settings = {};

// Enable source
source.enable = function (conf, _settings) {
    config = conf;
    settings = _settings;
}

// Get home results
source.getHome = function () {
    return getHomePager();
}

// Get search suggestions
source.searchSuggestions = function (query) {
    return [];
}

// Get search capabilities
source.getSearchCapabilities = function () {
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological],
        filters: []
    };
}

// Search channels
source.searchChannels = function (query, continuationToken) {
    return searchChannelPager(query, continuationToken);
}

// Get search results
source.search = function (query, type, order, filters, continuationToken) {
    return searchPager(query, continuationToken);
}

// Detect channel URL
source.isChannelUrl = function (url) {
    try {
        const parsed = new URL(url);
        const pathname = parsed.pathname.replace(/\/$/, '');
        return /^\/u\//.test(pathname) && pathname !== '/u/';
    } catch {
        return false;
    }
}

// Get channel details
source.getChannel = function (url) {
    const username = getLastPathSegment(url);
    return getChannelDetails(username);
}

// Get channel videos and posts (mixed content)
source.getChannelContents = function (url, type, order, filters, continuationToken) {
    const username = getLastPathSegment(url);
    return new ChannelContentPager(username);
}

// Get capabilities for channel search
source.getChannelSearchContentsCapabilities = function () {
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological],
        filters: []
    };
}

// Search channel videos
source.searchChannelContents = function (url, query, type, order, filters, continuationToken) {
    const username = getLastPathSegment(url);
    return getChannelVideosPager(username, continuationToken, query);
}

// Detect video or post URL
source.isContentDetailsUrl = function (url) {
    try {
        const parsed = new URL(url);
        const pathname = parsed.pathname.replace(/\/$/, '');
        return (/^\/v\//.test(pathname) && pathname !== '/v/') || /^\/post\//.test(pathname);
    } catch {
        return false;
    }
}

// Get video or post details
source.getContentDetails = function (url) {
    try {
        const parsed = new URL(url);
        if (/^\/post\//.test(parsed.pathname)) {
            const postId = getLastPathSegment(url);
            return getPostDetails(postId);
        }
    } catch {}
    const videoId = getLastPathSegment(url);
    return getVideoDetails(videoId, url);
}

// Get comments for videos or posts
source.getComments = function (url) {
    try {
        const parsed = new URL(url);
        if (/^\/post\//.test(parsed.pathname)) {
            const postId = getLastPathSegment(url);
            return getPostComments(postId);
        }
    } catch {}
    const videoId = getLastPathSegment(url);
    return getVideoComments(videoId);
}

// Get channel playlists
source.getChannelPlaylists = function (url) {
    const username = getLastPathSegment(url);
    return getChannelPlaylistsPager(username);
}

// Detect playlist URL
source.isPlaylistUrl = function (url) {
    try {
        const parsed = new URL(url);
        return /^\/playlist\//.test(parsed.pathname);
    } catch {
        return false;
    }
}

// Get playlist contents
source.getPlaylist = function (url) {
    const playlistId = getLastPathSegment(url);
    return getPlaylistVideosPager(playlistId);
}

// Get channel posts
source.getChannelPosts = function (url) {
    const username = getLastPathSegment(url);
    return getChannelPostsPager(username);
}

// Detect post URL
source.isPostUrl = function (url) {
    try {
        const parsed = new URL(url);
        return /^\/post\//.test(parsed.pathname);
    } catch {
        return false;
    }
}

// Get post details
source.getPost = function (url) {
    const postId = getLastPathSegment(url);
    return getPostDetails(postId);
}

function getLastPathSegment(url) {
    const urlObj = new URL(url);
    return urlObj.pathname.replace(/\/$/, '').split('/').pop();
}

/**
 * Make an authenticated HTTP GET request to the Vanillo API
 * @param {string} path - API path
 * @returns {object} Parsed JSON response
 */
function apiGet(path) {
    const url = api.base + path;
    const response = http.GET(url, { Accept: 'application/json' });
    if (!response.isOk)
        throw new ScriptException('API request failed: ' + url + ' [' + response.code + ']');
    return JSON.parse(response.body);
}

/**
 * Make an HTTP POST request to the Vanillo API
 * @param {string} path - API path
 * @param {object} body - Request body
 * @returns {object} Parsed JSON response
 */
function apiPost(path, body) {
    const url = api.base + path;
    const response = http.POST(url, JSON.stringify(body), { 'Content-Type': 'application/json', Accept: 'application/json' });
    if (!response.isOk)
        throw new ScriptException('API POST failed: ' + url + ' [' + response.code + ']');
    return JSON.parse(response.body);
}

/**
 * Get video source URLs (HLS/DASH) from watch token flow
 * @param {string} videoId - Video ID
 * @returns {object|null} Media object with hls/dash URLs
 */
function getVideoSource(videoId) {
    const watchResp = apiPost('/v1/watch', { videoId: videoId });
    const watchToken = watchResp.data.watchToken;
    if (!watchToken) return null;
    const manifestResp = apiGet('/v1/watch/manifests?watchToken=' + encodeURIComponent(watchToken));
    return manifestResp.data.media;
}

/**
 * Convert a raw video API object into a PlatformVideo feed item
 * @param {object} video - Video data from API
 * @returns {PlatformVideo}
 */
function videoFromApiItem(video) {
    const uploader = video.uploader || {};
    const uploaderName = uploader.displayName || uploader.username || 'Unknown';
    const uploaderUrl = uploader.url || uploader.id || '';
    const uploaderAvatar = uploader.avatar || platform.icon;
    const channelUrl = api.frontend + '/u/' + encodeURIComponent(uploaderUrl);
    const duration = video.duration ? Math.round(video.duration) : null;
    const uploadDate = video.publishedAt ? Math.round(new Date(video.publishedAt).getTime() / 1000) : null;
    const videoUrl = api.frontend + '/v/' + video.id;

    return new PlatformVideo({
        id: new PlatformID(platform.title, video.id, config.id),
        name: video.title || 'Unknown',
        thumbnails: new Thumbnails([new Thumbnail(video.thumbnail, 0)]),
        author: new PlatformAuthorLink(
            new PlatformID(platform.title, uploaderUrl, config.id),
            uploaderName,
            channelUrl,
            uploaderAvatar
        ),
        datetime: uploadDate,
        duration: duration,
        viewCount: parseInt(video.views) || 0,
        url: videoUrl,
        shareUrl: videoUrl,
        isLive: video.live || false
    });
}

/**
 * Convert a raw profile API object into a PlatformChannel
 * @param {object} profile - Profile data from API
 * @returns {PlatformChannel}
 */
function profileFromApiItem(profile) {
    const bannerUrl = profile.banner && profile.banner.lg ? profile.banner.lg : platform.banner;
    const avatarUrl = profile.avatar || platform.icon;
    const channelUrl = api.frontend + '/u/' + encodeURIComponent(profile.url || profile.id || '');
    const followers = parseInt(profile.followers) || 0;

    return new PlatformChannel({
        id: new PlatformID(platform.title, profile.id || '', config.id),
        name: profile.displayName || profile.username || 'Unknown',
        thumbnail: avatarUrl,
        banner: bannerUrl,
        subscribers: followers,
        description: profile.bio || '',
        url: channelUrl,
        links: {}
    });
}

/**
 * Get detailed video information with playback sources and recommendations
 * @param {string} videoId - Video ID
 * @param {string} url - Video page URL
 * @returns {PlatformVideoDetails}
 */
function getVideoDetails(videoId, url) {
    const resp = apiGet('/v1/videos/' + encodeURIComponent(videoId) + '?groups=uploader,profile.full');
    const data = resp.data;
    const category = data.category || '';
    const media = getVideoSource(videoId);
    const uploader = data.uploader || {};
    const uploaderName = uploader.displayName || uploader.username || 'Unknown';
    const uploaderUrl = uploader.url || uploader.id || '';
    const uploaderAvatar = uploader.avatar || platform.icon;
    const channelUrl = api.frontend + '/u/' + encodeURIComponent(uploaderUrl);
    const duration = data.duration ? Math.round(data.duration) : null;
    const uploadDate = data.publishedAt ? Math.round(new Date(data.publishedAt).getTime() / 1000) : null;
    const views = parseInt(data.views) || 0;

    let videoSources = [];

    if (media) {
        if (media.hls)
            videoSources.push(new HLSSource({
                name: 'HLS',
                url: media.hls,
                priority: true
            }));
        if (media.dash)
            videoSources.push(new DashSource({
                name: 'DASH',
                url: media.dash
            }));
    }

    return new PlatformVideoDetails({
        id: new PlatformID(platform.title, data.id || videoId, config.id),
        name: data.title || 'Unknown',
        thumbnails: new Thumbnails([new Thumbnail(data.thumbnail, 0)]),
        author: new PlatformAuthorLink(
            new PlatformID(platform.title, uploaderUrl, config.id),
            uploaderName,
            channelUrl,
            uploaderAvatar
        ),
        url: url || (api.frontend + '/v/' + videoId),
        uploadDate: uploadDate,
        duration: duration,
        views: views,
        description: data.description || '',
        isLive: data.live || false,
        video: new VideoSourceDescriptor(videoSources),
        getContentRecommendations: function () {
            return getRelatedVideosPager(category, videoId);
        }
    });
}

/**
 * Get paginated recommended videos from the same category
 * @param {string} category - Video category slug
 * @param {string} currentVideoId - Video ID to exclude
 * @returns {VideoPager}
 */
function getRelatedVideosPager(category, currentVideoId) {
    if (!category)
        return new VideoPager([], false);

    try {
        const resp = apiGet('/v1/videos?category=' + encodeURIComponent(category));
        const rawVideos = resp.data.videos || [];
        const videos = [];

        for (const video of rawVideos) {
            if (video.id === currentVideoId) continue;
            videos.push(videoFromApiItem(video));
        }

        return new VideoPager(videos, false);
    } catch (e) {
        return new VideoPager([], false);
    }
}

/**
 * Get channel/profile details
 * @param {string} username - Channel username or ID
 * @returns {PlatformChannel}
 */
function getChannelDetails(username) {
    const resp = apiGet('/v1/profiles/' + encodeURIComponent(username));
    const profile = resp.data;
    const bannerUrl = profile.banner && profile.banner.lg ? profile.banner.lg : platform.banner;
    const avatarUrl = profile.avatar || platform.icon;
    const channelUrl = api.frontend + '/u/' + encodeURIComponent(profile.url || username);
    const followers = parseInt(profile.followers) || 0;

    return new PlatformChannel({
        id: new PlatformID(platform.title, profile.id || username, config.id),
        name: profile.displayName || profile.username || 'Unknown',
        thumbnail: avatarUrl,
        banner: bannerUrl,
        subscribers: followers,
        description: profile.bio || '',
        url: channelUrl,
        links: {}
    });
}

/**
 * Get paginated channel videos
 * @param {string} username - Channel username or ID
 * @param {string} continuationToken - Offset for pagination
 * @param {string} query - Optional search filter
 * @returns {VanilloVideoPager}
 */
function getChannelVideosPager(username, continuationToken, query) {
    const profileResp = apiGet('/v1/profiles/' + encodeURIComponent(username));
    const profile = profileResp.data;
    const profileId = profile.id;
    const displayName = profile.displayName || profile.username || 'Unknown';
    const avatarUrl = profile.avatar || platform.icon;
    const channelUrl = api.frontend + '/u/' + encodeURIComponent(profile.url || username);

    const offset = continuationToken ? parseInt(continuationToken) : 0;
    const videosResp = apiGet('/v1/profiles/' + encodeURIComponent(profileId) + '/videos?offset=' + offset + '&limit=20');
    const rawVideos = videosResp.data.videos || [];
    const nextOffset = offset + rawVideos.length;

    const videos = [];
    for (const video of rawVideos) {
        if (query && !video.title.toLowerCase().includes(query.toLowerCase())) continue;

        const duration = video.duration ? Math.round(video.duration) : null;
        const uploadDate = video.publishedAt ? Math.round(new Date(video.publishedAt).getTime() / 1000) : null;
        const videoUrl = api.frontend + '/v/' + video.id;

        videos.push(new PlatformVideo({
            id: new PlatformID(platform.title, video.id, config.id),
            name: video.title || 'Unknown',
            thumbnails: new Thumbnails([new Thumbnail(video.thumbnail, 0)]),
            author: new PlatformAuthorLink(
                new PlatformID(platform.title, profile.url || username, config.id),
                displayName,
                channelUrl,
                avatarUrl
            ),
            datetime: uploadDate,
            duration: duration,
            viewCount: parseInt(video.views) || 0,
            url: videoUrl,
            shareUrl: videoUrl,
            isLive: video.live || false
        }));
    }

    const hasMore = rawVideos.length >= 20;
    return new VanilloVideoPager(videos, hasMore, { username: username, continuationToken: String(nextOffset), query: query });
}

/**
 * Get home feed with interleaved categories
 * @returns {VanilloVideoPager}
 */
function getHomePager() {
    const categories = ['commentary', 'gaming', 'film_and_animation', 'music', 'entertainment', 'education'];
    const perCategory = [];
    const seen = new Set();

    for (const category of categories) {
        try {
            const resp = apiGet('/v1/videos?category=' + encodeURIComponent(category));
            const rawVideos = resp.data.videos || [];
            const unique = [];
            for (const video of rawVideos) {
                if (!seen.has(video.id)) {
                    seen.add(video.id);
                    unique.push(video);
                }
            }
            perCategory.push(unique);
        } catch (e) {
            perCategory.push([]);
        }
    }

    const interleaved = [];
    let maxLen = 0;
    for (const arr of perCategory) {
        if (arr.length > maxLen) maxLen = arr.length;
    }
    for (let i = 0; i < maxLen; i++) {
        for (const arr of perCategory) {
            if (i < arr.length)
                interleaved.push(arr[i]);
        }
    }

    const videos = interleaved.map(function (v) { return videoFromApiItem(v); });
    return new VanilloVideoPager(videos, false, null);
}

/**
 * Search for videos
 * @param {string} query - Search query
 * @param {string} continuationToken - Page key for pagination
 * @returns {VanilloSearchVideoPager}
 */
function searchPager(query, continuationToken) {
    let path = '/v1/search?query=' + encodeURIComponent(query);
    if (continuationToken)
        path += '&pageKey=' + encodeURIComponent(continuationToken);

    const resp = apiGet(path);
    const results = resp.results || [];
    const nextPageKey = resp.nextPageKey || null;

    const videos = [];
    for (const item of results) {
        if (item.type === 'video')
            videos.push(videoFromApiItem(item));
    }

    const hasMore = !!nextPageKey;
    return new VanilloSearchVideoPager(videos, hasMore, { query: query, continuationToken: nextPageKey });
}

/**
 * Search for channels
 * @param {string} query - Search query
 * @param {string} continuationToken - Page key for pagination
 * @returns {SearchChannelPager}
 */
function searchChannelPager(query, continuationToken) {
    let path = '/v1/search?query=' + encodeURIComponent(query);
    if (continuationToken)
        path += '&pageKey=' + encodeURIComponent(continuationToken);

    const resp = apiGet(path);
    const results = resp.results || [];
    const nextPageKey = resp.nextPageKey || null;

    const channels = [];
    for (const item of results) {
        if (item.type === 'profile')
            channels.push(profileFromApiItem(item));
    }

    const hasMore = !!nextPageKey;
    return new SearchChannelPager(channels, hasMore, { query: query, continuationToken: nextPageKey });
}

/**
 * Get comments for a video
 * @param {string} videoId - Video ID
 * @returns {CommentPager}
 */
function getVideoComments(videoId) {
    const resp = apiGet('/v1/videos/' + encodeURIComponent(videoId) + '/comments');
    const data = resp.data;
    const rawComments = data.comments || [];
    const nextKey = data.nextPageKey || null;

    const comments = [];
    for (const c of rawComments) {
        const profile = c.profile || {};
        const avatar = profile.avatar || platform.icon;
        const commenterUrl = api.frontend + '/u/' + encodeURIComponent(profile.url || profile.id || '');
        const date = c.createdAt ? Math.round(new Date(c.createdAt).getTime() / 1000) : null;

        comments.push(new PlatformComment({
            id: new PlatformID(platform.title, c.id, config.id),
            author: new PlatformAuthorLink(
                new PlatformID(platform.title, profile.url || profile.id || '', config.id),
                profile.displayName || 'Unknown',
                commenterUrl,
                avatar
            ),
            message: c.text || '',
            date: date,
            likes: c.score || 0,
            isPinned: c.pinned || false
        }));
    }

    return new CommentsPager(comments, !!nextKey, { videoId: videoId, continuationToken: nextKey });
}

/**
 * Get comments for a post
 * @param {string} postId - Post ID
 * @returns {CommentPager}
 */
function getPostComments(postId) {
    const resp = apiGet('/v1/posts/' + encodeURIComponent(postId) + '/comments');
    const data = resp.data;
    const rawComments = data.comments || [];
    const nextKey = data.nextPageKey || null;

    const comments = [];
    for (const c of rawComments) {
        const profile = c.profile || {};
        const avatar = profile.avatar || platform.icon;
        const commenterUrl = api.frontend + '/u/' + encodeURIComponent(profile.url || profile.id || '');
        const date = c.createdAt ? Math.round(new Date(c.createdAt).getTime() / 1000) : null;

        comments.push(new PlatformComment({
            id: new PlatformID(platform.title, c.id, config.id),
            author: new PlatformAuthorLink(
                new PlatformID(platform.title, profile.url || profile.id || '', config.id),
                profile.displayName || 'Unknown',
                commenterUrl,
                avatar
            ),
            message: c.text || '',
            date: date,
            likes: c.score || 0,
            isPinned: c.pinned || false
        }));
    }

    return new CommentsPager(comments, !!nextKey, { postId: postId, continuationToken: nextKey });
}

/**
 * Get paginated playlists for a channel
 * @param {string} username - Channel username
 * @returns {VanilloPlaylistPager}
 */
function getChannelPlaylistsPager(username) {
    const resp = apiGet('/v1/profiles/' + encodeURIComponent(username) + '/playlists');
    const rawPlaylists = resp.data.playlists || [];

    const playlists = rawPlaylists.map(function (p) {
        return new PlatformPlaylist({
            id: new PlatformID(platform.title, p.id, config.id),
            name: p.name,
            thumbnail: p.thumbnail ? new Thumbnails([new Thumbnail(p.thumbnail, 0)]) : null,
            url: api.frontend + '/playlist/' + p.id,
            videoCount: p.videoCount || 0
        });
    });

    return new VanilloPlaylistPager(playlists, false, null);
}

/**
 * Get paginated videos in a playlist
 * @param {string} playlistId - Playlist ID
 * @returns {VideoPager}
 */
function getPlaylistVideosPager(playlistId) {
    const resp = apiGet('/v1/playlists/' + encodeURIComponent(playlistId) + '/videos');
    const rawVideos = resp.data.videos || [];

    const videos = rawVideos.map(function (v) {
        const uploader = v.uploader || {};
        const uploaderName = uploader.displayName || uploader.username || 'Unknown';
        const uploaderUrl = uploader.url || uploader.id || '';
        const uploaderAvatar = uploader.avatar || platform.icon;
        const channelUrl = api.frontend + '/u/' + encodeURIComponent(uploaderUrl);
        const duration = v.duration ? Math.round(v.duration) : null;
        const uploadDate = v.publishedAt ? Math.round(new Date(v.publishedAt).getTime() / 1000) : null;
        const videoUrl = api.frontend + '/v/' + v.id;

        return new PlatformVideo({
            id: new PlatformID(platform.title, v.id, config.id),
            name: v.title || 'Unknown',
            thumbnails: new Thumbnails([new Thumbnail(v.thumbnail, 0)]),
            author: new PlatformAuthorLink(
                new PlatformID(platform.title, uploaderUrl, config.id),
                uploaderName,
                channelUrl,
                uploaderAvatar
            ),
            datetime: uploadDate,
            duration: duration,
            viewCount: parseInt(v.views) || 0,
            url: videoUrl,
            shareUrl: videoUrl,
            isLive: v.live || false
        });
    });

    return new VideoPager(videos, false, null);
}

/**
 * Get paginated posts for a channel
 * @param {string} username - Channel username
 * @returns {VanilloPostPager}
 */
function getChannelPostsPager(username) {
    const resp = apiGet('/v1/posts/profile/' + encodeURIComponent(username));
    const rawPosts = resp.data.posts || [];

    const posts = rawPosts.map(function (p) {
        const profile = p.profile || {};
        const avatar = profile.avatar || platform.icon;
        const channelUrl = api.frontend + '/u/' + encodeURIComponent(profile.url || username);

        return new PlatformPostDetails({
            id: new PlatformID(platform.title, p.id, config.id),
            name: p.title || 'Untitled Post',
            author: new PlatformAuthorLink(
                new PlatformID(platform.title, profile.url || profile.id || '', config.id),
                profile.displayName || 'Unknown',
                channelUrl,
                avatar
            ),
            datetime: p.createdAt ? Math.round(new Date(p.createdAt).getTime() / 1000) : null,
            url: api.frontend + '/post/' + p.id,
            rating: new RatingLikes(p.score || 0),
            description: p.text || '',
            content: p.text || '',
            textType: Type.Text.Plain,
            images: [],
            thumbnails: []
        });
    });

    return new VanilloPostPager(posts, false, { username: username });
}

/**
 * Get details for a single post
 * @param {string} postId - Post ID
 * @returns {PlatformPostDetails}
 */
function getPostDetails(postId) {
    const resp = apiGet('/v1/posts/' + encodeURIComponent(postId));
    const p = resp.data.post;
    if (!p) throw new ScriptException('Post not found');

    const profile = p.profile || {};
    const avatar = profile.avatar || platform.icon;
    const channelUrl = api.frontend + '/u/' + encodeURIComponent(profile.url || '');

    return new PlatformPostDetails({
        id: new PlatformID(platform.title, p.id, config.id),
        name: p.title || 'Untitled Post',
        author: new PlatformAuthorLink(
            new PlatformID(platform.title, profile.url || profile.id || '', config.id),
            profile.displayName || 'Unknown',
            channelUrl,
            avatar
        ),
        datetime: p.createdAt ? Math.round(new Date(p.createdAt).getTime() / 1000) : null,
        url: api.frontend + '/post/' + p.id,
        rating: new RatingLikes(p.score || 0),
        description: p.text || '',
        content: p.text || '',
        textType: Type.Text.Plain,
        images: [],
        thumbnails: []
    });
}

class VanilloVideoPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        if (!this.hasMore || !this.context) return this;
        if (this.context.username) {
            return getChannelVideosPager(
                this.context.username,
                this.context.continuationToken,
                this.context.query
            );
        }
        this.hasMore = false;
        return this;
    }
}

class VanilloSearchVideoPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        if (!this.hasMore || !this.context) return this;
        return searchPager(this.context.query, this.context.continuationToken);
    }
}

class SearchChannelPager extends ChannelPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        if (!this.hasMore || !this.context) return this;
        return searchChannelPager(this.context.query, this.context.continuationToken);
    }
}

class CommentsPager extends CommentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        if (!this.hasMore || !this.context) return this;
        const id = this.context.videoId || this.context.postId;
        const path = this.context.videoId ? '/v1/videos/' : '/v1/posts/';
        const resp = apiGet(path + encodeURIComponent(id) + '/comments?pageKey=' + encodeURIComponent(this.context.continuationToken));
        const data = resp.data;
        const rawComments = data.comments || [];
        const nextKey = data.nextPageKey || null;

        const comments = [];
        for (const c of rawComments) {
            const profile = c.profile || {};
            const avatar = profile.avatar || platform.icon;
            const commenterUrl = api.frontend + '/u/' + encodeURIComponent(profile.url || profile.id || '');
            const date = c.createdAt ? Math.round(new Date(c.createdAt).getTime() / 1000) : null;

            comments.push(new PlatformComment({
                id: new PlatformID(platform.title, c.id, config.id),
                author: new PlatformAuthorLink(
                    new PlatformID(platform.title, profile.url || profile.id || '', config.id),
                    profile.displayName || 'Unknown',
                    commenterUrl,
                    avatar
                ),
                message: c.text || '',
                date: date,
                likes: c.score || 0,
                isPinned: c.pinned || false
            }));
        }

        return new CommentsPager(comments, !!nextKey, this.context);
    }
}

class VanilloPlaylistPager extends PlaylistPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        this.hasMore = false;
        return this;
    }
}

class ChannelContentPager extends ContentPager {
    constructor(username) {
        const videos = getChannelVideos(username);
        const posts = getChannelPosts(username);
        const combined = mergeContentByDate(videos, posts);
        super(combined, false);
    }

    nextPage() {
        this.hasMore = false;
        return this;
    }
}

function getChannelVideos(username) {
    try {
        const profileResp = apiGet('/v1/profiles/' + encodeURIComponent(username));
        const profile = profileResp.data;
        const profileId = profile.id;
        const displayName = profile.displayName || profile.username || 'Unknown';
        const avatarUrl = profile.avatar || platform.icon;
        const channelUrl = api.frontend + '/u/' + encodeURIComponent(profile.url || username);

        const videosResp = apiGet('/v1/profiles/' + encodeURIComponent(profileId) + '/videos?offset=0&limit=20');
        const rawVideos = videosResp.data.videos || [];

        return rawVideos.map(function (v) {
            const duration = v.duration ? Math.round(v.duration) : null;
            const uploadDate = v.publishedAt ? Math.round(new Date(v.publishedAt).getTime() / 1000) : null;
            const videoUrl = api.frontend + '/v/' + v.id;

            return new PlatformVideo({
                id: new PlatformID(platform.title, v.id, config.id),
                name: v.title || 'Unknown',
                thumbnails: new Thumbnails([new Thumbnail(v.thumbnail, 0)]),
                author: new PlatformAuthorLink(
                    new PlatformID(platform.title, profile.url || username, config.id),
                    displayName,
                    channelUrl,
                    avatarUrl
                ),
                datetime: uploadDate,
                duration: duration,
                viewCount: parseInt(v.views) || 0,
                url: videoUrl,
                shareUrl: videoUrl,
                isLive: v.live || false
            });
        });
    } catch (e) {
        return [];
    }
}

function getChannelPosts(username) {
    try {
        const resp = apiGet('/v1/posts/profile/' + encodeURIComponent(username));
        const rawPosts = resp.data.posts || [];

        return rawPosts.map(function (p) {
            const profile = p.profile || {};
            const avatar = profile.avatar || platform.icon;
            const channelUrl = api.frontend + '/u/' + encodeURIComponent(profile.url || username);

            return new PlatformPostDetails({
                id: new PlatformID(platform.title, p.id, config.id),
                name: p.title || 'Untitled Post',
                author: new PlatformAuthorLink(
                    new PlatformID(platform.title, profile.url || profile.id || '', config.id),
                    profile.displayName || 'Unknown',
                    channelUrl,
                    avatar
                ),
                datetime: p.createdAt ? Math.round(new Date(p.createdAt).getTime() / 1000) : null,
                url: api.frontend + '/post/' + p.id,
                rating: new RatingLikes(p.score || 0),
                description: p.text || '',
                content: p.text || '',
                textType: Type.Text.Plain,
                images: [],
                thumbnails: []
            });
        });
    } catch (e) {
        return [];
    }
}

function mergeContentByDate(videos, posts) {
    const combined = [];
    let vi = 0, pi = 0;
    while (vi < videos.length || pi < posts.length) {
        if (pi >= posts.length || (vi < videos.length && videos[vi].datetime >= posts[pi].datetime)) {
            combined.push(videos[vi]);
            vi++;
        } else {
            combined.push(posts[pi]);
            pi++;
        }
    }
    return combined;
}

class VanilloPostPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        this.hasMore = false;
        return this;
    }
}
