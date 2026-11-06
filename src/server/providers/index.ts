import { VideoProvider } from '../types';
import { VidAPIProvider } from './vidapi';
import { BoxMovieProvider } from './boxmovie';
import { EclipseProvider } from './eclipse';
import { LMScriptProvider } from './lmscript';
import { MeowTVProvider } from './meowtv';

export const providers: Record<string, VideoProvider> = {
    vidapi: new VidAPIProvider({ priority: 1, label: 'Vector' }),
    lmscript: new LMScriptProvider({ priority: 2, label: 'Valence' }),
    eclipse: new EclipseProvider({ priority: 3, label: 'Eclipse' }),
    boxmovie: new BoxMovieProvider({ priority: 4, label: 'BoxMovie' }),
    meowtv: new MeowTVProvider({ priority: 5, label: 'Apex' })
};

export function getActiveProviders(): VideoProvider[] {
    return Object.values(providers)
        .filter(p => p.enabled !== false)
        .sort((a, b) => a.priority - b.priority);
}
