import React from 'react';
import {
  buildImageProxyUrl,
  isProxiedImagePath,
  resolveSafeImageSrc
} from '../../utils/imageUrl';

export interface GenreItem {
  id: number;
  name: string;
  backdrop: string;
  accentColor: string;
}

export const POPULAR_GENRES: GenreItem[] = [
  {
    id: 28,
    name: 'Action',
    backdrop: 'https://image.tmdb.org/t/p/w780/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
    accentColor: 'from-amber-600/30'
  },
  {
    id: 878,
    name: 'Science Fiction',
    backdrop: 'https://image.tmdb.org/t/p/w780/jYEW5xZkZk2WTrdbMGAPFuBqbDc.jpg',
    accentColor: 'from-cyan-600/30'
  },
  {
    id: 27,
    name: 'Horror',
    backdrop: 'https://image.tmdb.org/t/p/w780/etj8E2o0Bud0HkONVQPjyCkIvpv.jpg',
    accentColor: 'from-red-600/30'
  },
  {
    id: 35,
    name: 'Comedy',
    backdrop: 'https://image.tmdb.org/t/p/w780/yDHYTfA3R0jFYba16jBB1ef8oIt.jpg',
    accentColor: 'from-yellow-600/30'
  },
  {
    id: 16,
    name: 'Animation',
    backdrop: 'https://image.tmdb.org/t/p/w780/xLg6LRJ6VqwJX3ZiB6mRhLYAg3I.jpg',
    accentColor: 'from-purple-600/30'
  },
  {
    id: 53,
    name: 'Thriller',
    backdrop: 'https://image.tmdb.org/t/p/w780/ctiw6FZK4N36LmkjSklWEbuvlq9.jpg',
    accentColor: 'from-emerald-600/30'
  },
  {
    id: 12,
    name: 'Adventure',
    backdrop: 'https://image.tmdb.org/t/p/w780/bccR2CGTWVVSZAG0yqmy3DIvhTX.jpg',
    accentColor: 'from-orange-600/30'
  },
  {
    id: 18,
    name: 'Drama',
    backdrop: 'https://image.tmdb.org/t/p/w780/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
    accentColor: 'from-blue-600/30'
  },
  {
    id: 10749,
    name: 'Romance',
    backdrop: 'https://image.tmdb.org/t/p/w780/vL5LR6WdxWPjLPFRLe133jXWsh5.jpg',
    accentColor: 'from-pink-600/30'
  },
  {
    id: 80,
    name: 'Crime',
    backdrop: 'https://image.tmdb.org/t/p/w780/dqK9Hag1054tghRQSqLSfrkvQnA.jpg',
    accentColor: 'from-violet-600/30'
  },
  {
    id: 14,
    name: 'Fantasy',
    backdrop: 'https://image.tmdb.org/t/p/w780/4gV0rKUjB1nLUdZB4zIltLvNZZr.jpg',
    accentColor: 'from-indigo-600/30'
  },
  {
    id: 99,
    name: 'Documentary',
    backdrop: 'https://images.metahub.space/background/medium/tt0795176/img',
    accentColor: 'from-teal-600/30'
  }
];

interface GenreCardProps {
  genre: GenreItem;
  onClick: (genreId: number) => void;
}

export const GenreCard: React.FC<GenreCardProps> = ({ genre, onClick }) => {
  const [imgSrc, setImgSrc] = React.useState(() => resolveSafeImageSrc(genre.backdrop));
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgSrc(resolveSafeImageSrc(genre.backdrop));
    setImgError(false);
  }, [genre.id, genre.backdrop]);

  const handleImgError = () => {
    if (genre.backdrop && !isProxiedImagePath(imgSrc) && genre.backdrop.startsWith('http')) {
      setImgSrc(buildImageProxyUrl(genre.backdrop));
    } else {
      setImgError(true);
    }
  };

  return (
    <div
      onClick={() => onClick(genre.id)}
      className="shrink-0 snap-start w-[170px] sm:w-[210px] h-[100px] sm:h-[115px] group cursor-pointer relative rounded-xl overflow-hidden bg-[#29292D] border border-[#3A3A40] hover:border-[#F5C400] transition-all duration-300 select-none hover:-translate-y-1 shadow-md hover:shadow-xl"
    >
      {/* Background Artwork */}
      {!imgError && imgSrc && (
        <img
          src={imgSrc}
          alt={genre.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 filter brightness-65 group-hover:brightness-75"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleImgError}
        />
      )}

      {/* Dark Ambient Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-t ${genre.accentColor} via-black/50 to-black/30 pointer-events-none`} />

      {/* Center Label */}
      <div className="absolute inset-0 p-3 flex flex-col justify-end">
        <h4 className="text-sm sm:text-base font-black text-white group-hover:text-[#F5C400] transition-colors tracking-tight">
          {genre.name}
        </h4>
        <span className="text-[10px] text-slate-300 font-semibold group-hover:text-white transition-colors">
          Browse movies & series →
        </span>
      </div>

      {/* Bottom Accent Bar */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-transparent group-hover:bg-[#F5C400] transition-colors" />
    </div>
  );
};
