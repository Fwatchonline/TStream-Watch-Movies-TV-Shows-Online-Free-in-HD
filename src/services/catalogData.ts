import { MediaItem, MovieDetail, TVDetail, CollectionSummary, Genre, MediaType } from '../types/media';

export const ALL_GENRES: Genre[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 10770, name: 'TV Movie' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
  { id: 10759, name: 'Action & Adventure' },
  { id: 10765, name: 'Sci-Fi & Fantasy' }
];

export const SPIDERMAN_COLLECTION: CollectionSummary = {
  id: 531241,
  name: 'Spider-Man (MCU) Collection',
  posterPath: 'https://image.tmdb.org/t/p/w500/yeba3Y820OjApZO9aJevDsNeMEd.jpg',
  backdropPath: 'https://image.tmdb.org/t/p/original/AvnqpRwlEaYNVL6wzC4RN94EdSd.jpg',
  overview: 'The Marvel Cinematic Universe films featuring Peter Parker / Spider-Man, navigating school life and high-stakes superhero duties alongside the Avengers.',
  parts: [
    {
      id: 315635,
      tmdbId: 315635,
      imdbId: 'tt2250912',
      title: 'Spider-Man: Homecoming',
      overview: 'Following the events of Captain America: Civil War, Peter Parker attempts to balance his life in high school with his career as the web-slinging superhero Spider-Man.',
      posterPath: 'https://image.tmdb.org/t/p/w500/c24sv2weTHPsmDa7jEMN0m2P3RT.jpg',
      backdropPath: 'https://images.metahub.space/background/medium/tt2250912/img',
      releaseDate: '2017-07-05',
      voteAverage: 7.4,
      voteCount: 21540,
      popularity: 88.5,
      genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 878, name: 'Science Fiction' }],
      mediaType: 'movie',
      certification: 'PG-13',
      runtime: 133
    },
    {
      id: 429617,
      tmdbId: 429617,
      imdbId: 'tt6320628',
      title: 'Spider-Man: Far From Home',
      overview: 'Peter Parker and his friends go on a summer trip to Europe. However, they will hardly be able to rest - Peter will have to agree to help Nick Fury uncover the mystery of creatures causing natural catastrophes.',
      posterPath: 'https://image.tmdb.org/t/p/w500/4q2NNj4S5dG2RLF9CpXsej7yXl.jpg',
      backdropPath: 'https://images.metahub.space/background/medium/tt6320628/img',
      releaseDate: '2019-06-28',
      voteAverage: 7.5,
      voteCount: 15300,
      popularity: 94.2,
      genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 878, name: 'Science Fiction' }],
      mediaType: 'movie',
      certification: 'PG-13',
      runtime: 129
    },
    {
      id: 634649,
      tmdbId: 634649,
      imdbId: 'tt10872600',
      title: 'Spider-Man: No Way Home',
      overview: 'Peter Parker is unmasked and no longer able to separate his normal life from the high-stakes of being a super-hero. When he asks for help from Doctor Strange, the stakes become even more dangerous.',
      posterPath: 'https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
      backdropPath: 'https://images.metahub.space/background/medium/tt10872600/img',
      releaseDate: '2021-12-15',
      voteAverage: 8.0,
      voteCount: 19800,
      popularity: 142.1,
      genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 878, name: 'Science Fiction' }],
      mediaType: 'movie' as MediaType,
      certification: 'PG-13',
      runtime: 148
    },
    {
      id: 1112026,
      tmdbId: 1112026,
      imdbId: 'tt14362112',
      title: 'Spider-Man: Brand New Day',
      overview: 'Fighting crime full-time as Spider-Man in a world that doesn\'t remember him—and the pressure of seeing his old friends move on without him—sparks a change in Peter Parker he may not have the power to control. But that transformation might also be the only thing that can stop a shocking new threat to the city and those he loves - a powerful villain no one can even see.',
      posterPath: 'https://images.metahub.space/poster/medium/tt22084616/img',
      backdropPath: 'https://image.tmdb.org/t/p/original/AvnqpRwlEaYNVL6wzC4RN94EdSd.jpg',
      releaseDate: '2026-07-29',
      voteAverage: 7.8,
      voteCount: 2789,
      popularity: 245.8,
      genres: [{ id: 878, name: 'Science Fiction' }, { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }],
      mediaType: 'movie' as MediaType,
      certification: 'PG-13',
      runtime: 145,
      director: 'Destin Daniel Cretton',
      writer: 'Erik Sommers',
      matchPercentage: 78,
      topTen: true,
      viewsCount: 166
    }
  ]
};

export const AVENGERS_COLLECTION: CollectionSummary = {
  id: 86311,
  name: 'The Avengers Collection',
  posterPath: 'https://image.tmdb.org/t/p/w500/yFSIUVTCvgYrpalUktulvk3Gi5Y.jpg',
  backdropPath: 'https://image.tmdb.org/t/p/original/2UNUv4NJdC36E5myDHACBJ99EwL.jpg',
  overview: 'Earth\'s mightiest heroes assemble to defend humanity against extraterrestrial and cosmic threats.',
  parts: [
    {
      id: 24428,
      tmdbId: 24428,
      imdbId: 'tt0848228',
      title: 'The Avengers',
      overview: 'When an unexpected enemy emerges and threatens global safety and security, Nick Fury finds himself in need of a team to pull the world back from the brink of disaster.',
      posterPath: 'https://image.tmdb.org/t/p/w500/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/original/9BBTo63ANSmhC4e6r62OJFuK2GL.jpg',
      releaseDate: '2012-04-25',
      voteAverage: 7.7,
      voteCount: 30120,
      popularity: 110.4,
      genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 878, name: 'Science Fiction' }],
      mediaType: 'movie',
      certification: 'PG-13',
      runtime: 143
    },
    {
      id: 99861,
      tmdbId: 99861,
      imdbId: 'tt2395427',
      title: 'Avengers: Age of Ultron',
      overview: 'When Tony Stark tries to jumpstart a dormant peacekeeping program, things go awry and Earth\'s Mightiest Heroes are put to the ultimate test.',
      posterPath: 'https://image.tmdb.org/t/p/w500/4ssDuvEDkSArWEdyBl2X5EHvYKU.jpg',
      backdropPath: 'https://images.metahub.space/background/medium/tt2395427/img',
      releaseDate: '2015-04-22',
      voteAverage: 7.3,
      voteCount: 22400,
      popularity: 98.7,
      genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 878, name: 'Science Fiction' }],
      mediaType: 'movie',
      certification: 'PG-13',
      runtime: 141
    },
    {
      id: 299536,
      tmdbId: 299536,
      imdbId: 'tt4154756',
      title: 'Avengers: Infinity War',
      overview: 'As the Avengers and their allies have continued to protect the world from threats too large for any one hero to handle, a new danger has emerged from the cosmic shadows: Thanos.',
      posterPath: 'https://image.tmdb.org/t/p/w500/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg',
      backdropPath: 'https://images.metahub.space/background/medium/tt4154756/img',
      releaseDate: '2018-04-25',
      voteAverage: 8.3,
      voteCount: 28900,
      popularity: 185.2,
      genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 878, name: 'Science Fiction' }],
      mediaType: 'movie',
      certification: 'PG-13',
      runtime: 149
    },
    {
      id: 299534,
      tmdbId: 299534,
      imdbId: 'tt4154796',
      title: 'Avengers: Endgame',
      overview: 'After the devastating events of Avengers: Infinity War, the universe is in ruins. With the help of remaining allies, the Avengers assemble once more to reverse Thanos\' actions.',
      posterPath: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/original/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg',
      releaseDate: '2019-04-24',
      voteAverage: 8.3,
      voteCount: 25100,
      popularity: 160.8,
      genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 878, name: 'Science Fiction' }],
      mediaType: 'movie',
      certification: 'PG-13',
      runtime: 181
    }
  ]
};

export const HARRY_POTTER_COLLECTION: CollectionSummary = {
  id: 1241,
  name: 'Harry Potter Collection',
  posterPath: 'https://image.tmdb.org/t/p/w500/eVPs2Y0LyvTLZn6AP5Z6O2rtiGB.jpg',
  backdropPath: 'https://image.tmdb.org/t/p/original/4gV0rKUjB1nLUdZB4zIltLvNZZr.jpg',
  overview: 'The legendary fantasy film series based on the novels by J.K. Rowling following young wizard Harry Potter and his adventures at Hogwarts.',
  parts: [
    {
      id: 671,
      tmdbId: 671,
      imdbId: 'tt0241527',
      title: 'Harry Potter and the Philosopher\'s Stone',
      overview: 'Harry Potter has lived under the stairs at his aunt and uncle\'s house his whole life. But on his 11th birthday, he learns he\'s a powerful wizard.',
      posterPath: 'https://image.tmdb.org/t/p/w500/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg',
      backdropPath: 'https://images.metahub.space/background/medium/tt0241527/img',
      releaseDate: '2001-11-16',
      voteAverage: 7.9,
      voteCount: 26500,
      popularity: 125.4,
      genres: [{ id: 12, name: 'Adventure' }, { id: 14, name: 'Fantasy' }],
      mediaType: 'movie',
      certification: 'PG',
      runtime: 152
    },
    {
      id: 672,
      tmdbId: 672,
      imdbId: 'tt0295297',
      title: 'Harry Potter and the Chamber of Secrets',
      overview: 'Cars fly, trees fight back, and a mysterious house-elf comes to warn Harry Potter at the start of his second year at Hogwarts School of Witchcraft and Wizardry.',
      posterPath: 'https://image.tmdb.org/t/p/w500/1stUIsjawROZxjiCMtqqXqgfZWC.jpg',
      backdropPath: 'https://images.metahub.space/background/medium/tt0295297/img',
      releaseDate: '2002-11-15',
      voteAverage: 7.7,
      voteCount: 21400,
      popularity: 98.2,
      genres: [{ id: 12, name: 'Adventure' }, { id: 14, name: 'Fantasy' }],
      mediaType: 'movie',
      certification: 'PG',
      runtime: 161
    },
    {
      id: 673,
      tmdbId: 673,
      imdbId: 'tt0304141',
      title: 'Harry Potter and the Prisoner of Azkaban',
      overview: 'Year three at Hogwarts means new fun and challenges as Harry learns the delicate art of approaching a Hippogriff, transforming shape-shifting Boggarts, and evading the deadly Dementors.',
      posterPath: 'https://image.tmdb.org/t/p/w500/obKmfNexgL4ZP5cAmzdL4KbHHYX.jpg',
      backdropPath: 'https://images.metahub.space/background/medium/tt0304141/img',
      releaseDate: '2004-05-31',
      voteAverage: 8.0,
      voteCount: 20900,
      popularity: 112.5,
      genres: [{ id: 12, name: 'Adventure' }, { id: 14, name: 'Fantasy' }],
      mediaType: 'movie',
      certification: 'PG',
      runtime: 142
    }
  ]
};

export const PIRATES_COLLECTION: CollectionSummary = {
  id: 295,
  name: 'Pirates of the Caribbean Collection',
  posterPath: 'https://image.tmdb.org/t/p/w500/zRBaZxS5YauLvRYjAdL4AUCwlht.jpg',
  backdropPath: 'https://image.tmdb.org/t/p/original/wxgD3fB5lQ2sGJLog0rvXW049Pf.jpg',
  overview: 'The seafaring pirate adventures of Captain Jack Sparrow, Will Turner, and Elizabeth Swann across uncharted Caribbean waters.',
  parts: [
    {
      id: 22,
      tmdbId: 22,
      imdbId: 'tt0325980',
      title: 'Pirates of the Caribbean: The Curse of the Black Pearl',
      overview: 'Jack Sparrow, a freewheeling 18th-century pirate, teams up with blacksmith Will Turner to rescue the Governor\'s daughter from Jack\'s former pirate allies.',
      posterPath: 'https://image.tmdb.org/t/p/w500/zRBaZxS5YauLvRYjAdL4AUCwlht.jpg',
      backdropPath: 'https://images.metahub.space/background/medium/tt0325980/img',
      releaseDate: '2003-07-09',
      voteAverage: 7.8,
      voteCount: 20400,
      popularity: 105.3,
      genres: [{ id: 12, name: 'Adventure' }, { id: 14, name: 'Fantasy' }, { id: 28, name: 'Action' }],
      mediaType: 'movie',
      certification: 'PG-13',
      runtime: 143
    },
    {
      id: 58,
      tmdbId: 58,
      imdbId: 'tt0383574',
      title: 'Pirates of the Caribbean: Dead Man\'s Chest',
      overview: 'Captain Jack Sparrow works his way out of a blood debt with the ghostly Davy Jones to avoid the eternal damnation of his soul.',
      posterPath: 'https://image.tmdb.org/t/p/w500/uXEqmloGyP7UXAiphJUu2v2pcuE.jpg',
      backdropPath: 'https://images.metahub.space/background/medium/tt0383574/img',
      releaseDate: '2006-07-06',
      voteAverage: 7.3,
      voteCount: 16200,
      popularity: 89.1,
      genres: [{ id: 12, name: 'Adventure' }, { id: 14, name: 'Fantasy' }, { id: 28, name: 'Action' }],
      mediaType: 'movie',
      certification: 'PG-13',
      runtime: 151
    }
  ]
};

// Complete movie catalogue with real TMDB IDs, IMDb IDs, and cast
export const DETAILED_MOVIES: MovieDetail[] = [
  {
    id: 1112026,
    tmdbId: 1112026,
    imdbId: 'tt14362112',
    title: 'Spider-Man: Brand New Day',
    overview: 'Fighting crime full-time as Spider-Man in a world that doesn\'t remember him—and the pressure of seeing his old friends move on without him—sparks a change in Peter Parker he may not have the power to control. But that transformation might also be the only thing that can stop a shocking new threat to the city and those he loves - a powerful villain no one can even see.',
    posterPath: 'https://images.metahub.space/poster/medium/tt22084616/img',
    backdropPath: 'https://image.tmdb.org/t/p/original/AvnqpRwlEaYNVL6wzC4RN94EdSd.jpg',
    releaseDate: '2026-07-29',
    voteAverage: 7.8,
    voteCount: 2789,
    popularity: 295.4,
    genres: [{ id: 878, name: 'Science Fiction' }, { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }],
    mediaType: 'movie',
    certification: 'PG-13',
    runtime: 145,
    tagline: 'A brand new day starts now.',
    director: 'Destin Daniel Cretton',
    writer: 'Erik Sommers',
    status: 'Released',
    budget: 225000000,
    revenue: 2500000000,
    budgetFormatted: '$225M',
    revenueFormatted: '$2.5B',
    matchPercentage: 78,
    topTen: true,
    viewsCount: 166,
    productionCompanies: [
      { id: 420, name: 'Marvel Studios', logoPath: null, originCountry: 'US' },
      { id: 5, name: 'Columbia Pictures', logoPath: null, originCountry: 'US' },
      { id: 84041, name: 'Pascal Pictures', logoPath: null, originCountry: 'US' },
      { id: 25, name: 'TSG Entertainment', logoPath: null, originCountry: 'US' }
    ],
    productionCountries: ['United States of America'],
    spokenLanguages: ['English'],
    belongsToCollection: SPIDERMAN_COLLECTION,
    videos: [
      { id: 'v_sp26_1', key: 'JfVOs4VSpmA', name: 'Watch this scene on the big screen (again)', site: 'YouTube', type: 'Clip', official: true },
      { id: 'v_sp26_2', key: 'rt-2cxAiPJk', name: 'Orchestra Recording Session', site: 'YouTube', type: 'Behind the Scenes', official: true },
      { id: 'v_sp26_3', key: 'zSWdZVtXT7E', name: 'Thwip', site: 'YouTube', type: 'Featurette', official: true },
      { id: 'v_sp26_4', key: 'EXeTwQWrcwY', name: 'Making Spider-Man: Brand New Day was a labour of love.', site: 'YouTube', type: 'Behind the Scenes', official: true },
      { id: 'v_sp26_5', key: 'Way9Dexny3w', name: 'See It Again', site: 'YouTube', type: 'Teaser', official: true }
    ],
    cast: [
      { id: 1136406, name: 'Tom Holland', character: 'Peter Parker / Spider-Man', profilePath: null, order: 0 },
      { id: 505710, name: 'Zendaya', character: 'Michelle "MJ" Jones', profilePath: null, order: 1 },
      { id: 1649152, name: 'Jacob Batalon', character: 'Ned Leeds', profilePath: null, order: 2 },
      { id: 3131, name: 'Jon Favreau', character: 'Happy Hogan', profilePath: null, order: 3 },
      { id: 103, name: 'Mark Ruffalo', character: 'Bruce Banner / Hulk', profilePath: null, order: 4 }
    ],
    keywords: [
      { id: 1, name: 'mind control' },
      { id: 242, name: 'new york city' },
      { id: 3, name: 'hero' },
      { id: 4, name: 'mutation' },
      { id: 5, name: 'secret identity' },
      { id: 9715, name: 'superhero' },
      { id: 7, name: 'spider' },
      { id: 8, name: 'villain' },
      { id: 9, name: 'based on comic' },
      { id: 10, name: 'sequel' },
      { id: 11, name: 'transhumanism' },
      { id: 12, name: 'super power' }
    ],
    similar: [
      {
        id: 201,
        tmdbId: 201,
        title: 'Condorito: The Movie',
        overview: 'Condorito and his nephew Chicky embark on a hilarious adventure to save the planet from an evil alien threat.',
        posterPath: 'https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
        backdropPath: 'https://image.tmdb.org/t/p/original/yDHYTfA3R0jFYba16jBB1ef8oIt.jpg',
        releaseDate: '2017-10-12',
        voteAverage: 6.9,
        voteCount: 140,
        popularity: 42.1,
        genres: [{ id: 16, name: 'Animation' }, { id: 35, name: 'Comedy' }],
        mediaType: 'movie' as MediaType
      },
      {
        id: 202,
        tmdbId: 202,
        title: 'Live Free or Die Hard',
        overview: 'John McClane takes on an Internet-based terrorist organization who is systematically shutting down the United States.',
        posterPath: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
        backdropPath: 'https://image.tmdb.org/t/p/original/9FE5eD92WfVCiivM9Pq9GVSrlWk.jpg',
        releaseDate: '2007-06-20',
        voteAverage: 6.6,
        voteCount: 5400,
        popularity: 65.2,
        genres: [{ id: 28, name: 'Action' }, { id: 53, name: 'Thriller' }],
        mediaType: 'movie' as MediaType
      },
      {
        id: 203,
        tmdbId: 203,
        title: 'Die Hard: With a Vengeance',
        overview: 'John McClane and an unlucky Harlem store owner are targeted by German terrorist Simon Gruber in New York City.',
        posterPath: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
        backdropPath: 'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
        releaseDate: '1995-05-19',
        voteAverage: 7.3,
        voteCount: 6200,
        popularity: 70.4,
        genres: [{ id: 28, name: 'Action' }, { id: 53, name: 'Thriller' }],
        mediaType: 'movie' as MediaType
      },
      {
        id: 204,
        tmdbId: 204,
        title: 'Die Hard 2',
        overview: 'John McClane attempts to avert disaster as rogue military commandos seize control of Dulles International Airport in Washington, D.C.',
        posterPath: 'https://image.tmdb.org/t/p/w500/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg',
        backdropPath: 'https://images.metahub.space/background/medium/tt9218128/img',
        releaseDate: '1990-07-03',
        voteAverage: 7.0,
        voteCount: 4800,
        popularity: 58.1,
        genres: [{ id: 28, name: 'Action' }, { id: 53, name: 'Thriller' }],
        mediaType: 'movie' as MediaType
      },
      {
        id: 205,
        tmdbId: 205,
        title: 'Resident Evil: Apocalypse',
        overview: 'Alice awakens in the Raccoon City hospital after the city has been overrun by zombies and monsters.',
        posterPath: 'https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg',
        backdropPath: 'https://images.metahub.space/background/medium/tt1877830/img',
        releaseDate: '2004-09-10',
        voteAverage: 6.4,
        voteCount: 3900,
        popularity: 62.4,
        genres: [{ id: 28, name: 'Action' }, { id: 27, name: 'Horror' }],
        mediaType: 'movie' as MediaType
      },
      {
        id: 206,
        tmdbId: 206,
        title: 'The Legend of Zorro',
        overview: 'Having spent the last ten years fighting injustice, Alejandro de la Vega is now faced with his greatest challenge: his wife and son.',
        posterPath: 'https://images.metahub.space/poster/medium/tt0383574/img',
        backdropPath: 'https://images.metahub.space/background/medium/tt0383574/img',
        releaseDate: '2005-10-24',
        voteAverage: 6.1,
        voteCount: 3200,
        popularity: 54.3,
        genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }],
        mediaType: 'movie' as MediaType
      }
    ],
    recommendations: [
      {
        id: 634649,
        tmdbId: 634649,
        title: 'Spider-Man: No Way Home',
        overview: 'Peter Parker is unmasked and asks for help from Doctor Strange.',
        posterPath: 'https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
        backdropPath: 'https://images.metahub.space/background/medium/tt10872600/img',
        releaseDate: '2021-12-15',
        voteAverage: 8.0,
        voteCount: 19800,
        popularity: 142.1,
        genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }],
        mediaType: 'movie' as MediaType
      },
      {
        id: 1930,
        tmdbId: 1930,
        title: 'The Amazing Spider-Man',
        overview: 'Peter Parker finds a clue that might help him understand why his parents disappeared when he was young.',
        posterPath: 'https://images.metahub.space/poster/medium/tt6320628/img',
        backdropPath: 'https://images.metahub.space/background/medium/tt6320628/img',
        releaseDate: '2012-06-23',
        voteAverage: 6.7,
        voteCount: 16500,
        popularity: 112.4,
        genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }],
        mediaType: 'movie' as MediaType
      },
      {
        id: 640146,
        tmdbId: 640146,
        title: 'Ant-Man and the Wasp: Quantumania',
        overview: 'Super-Hero partners Scott Lang and Hope van Dyne find themselves exploring the Quantum Realm.',
        posterPath: 'https://image.tmdb.org/t/p/w500/c24sv2weTHPsmDa7jEMN0m2P3RT.jpg',
        backdropPath: 'https://images.metahub.space/background/medium/tt2250912/img',
        releaseDate: '2023-02-15',
        voteAverage: 6.3,
        voteCount: 4600,
        popularity: 98.7,
        genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }],
        mediaType: 'movie' as MediaType
      },
      {
        id: 447365,
        tmdbId: 447365,
        title: 'Guardians of the Galaxy Vol. 3',
        overview: 'Peter Quill rallies his team around him on a dangerous mission to save Rocket\'s life.',
        posterPath: 'https://image.tmdb.org/t/p/w500/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg',
        backdropPath: 'https://images.metahub.space/background/medium/tt4154756/img',
        releaseDate: '2023-05-03',
        voteAverage: 8.0,
        voteCount: 6500,
        popularity: 124.5,
        genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }],
        mediaType: 'movie' as MediaType
      },
      {
        id: 271110,
        tmdbId: 271110,
        title: 'Captain America: Civil War',
        overview: 'Following the events of Age of Ultron, the collective governments of the world pass an act designed to regulate all superhuman activity.',
        posterPath: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
        backdropPath: 'https://image.tmdb.org/t/p/original/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg',
        releaseDate: '2016-04-27',
        voteAverage: 7.4,
        voteCount: 21800,
        popularity: 118.2,
        genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }],
        mediaType: 'movie' as MediaType
      },
      {
        id: 298618,
        tmdbId: 298618,
        title: 'The Flash',
        overview: 'When his attempt to save his family unintentionally alters the future, Barry Allen becomes trapped in a reality with no super heroes.',
        posterPath: 'https://images.metahub.space/poster/medium/tt0848228/img',
        backdropPath: 'https://image.tmdb.org/t/p/original/9BBTo63ANSmhC4e6r62OJFuK2GL.jpg',
        releaseDate: '2023-06-13',
        voteAverage: 6.7,
        voteCount: 3900,
        popularity: 104.3,
        genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }],
        mediaType: 'movie' as MediaType
      }
    ]
  },
  {
    id: 634649,
    tmdbId: 634649,
    imdbId: 'tt10872600',
    title: 'Spider-Man: No Way Home',
    overview: 'Peter Parker is unmasked and no longer able to separate his normal life from the high-stakes of being a super-hero. When he asks for help from Doctor Strange the stakes become even more dangerous, forcing him to discover what it truly means to be Spider-Man.',
    posterPath: 'https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
    backdropPath: 'https://images.metahub.space/background/medium/tt10872600/img',
    releaseDate: '2021-12-15',
    voteAverage: 8.0,
    voteCount: 19800,
    popularity: 142.1,
    genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 878, name: 'Science Fiction' }],
    mediaType: 'movie',
    certification: 'PG-13',
    runtime: 148,
    tagline: 'The Multiverse unleashed.',
    status: 'Released',
    budget: 200000000,
    revenue: 1921847111,
    productionCompanies: [
      { id: 420, name: 'Marvel Studios', logoPath: null, originCountry: 'US' },
      { id: 84041, name: 'Pascal Pictures', logoPath: null, originCountry: 'US' },
      { id: 5, name: 'Columbia Pictures', logoPath: null, originCountry: 'US' }
    ],
    productionCountries: ['United States of America'],
    spokenLanguages: ['English', 'Tagalog'],
    belongsToCollection: SPIDERMAN_COLLECTION,
    videos: [
      { id: 'v1', key: 'JfVOs4VSpmA', name: 'Official Trailer', site: 'YouTube', type: 'Trailer', official: true },
      { id: 'v2', key: 'rt-2cxAiPJk', name: 'Teaser Trailer', site: 'YouTube', type: 'Teaser', official: true }
    ],
    cast: [
      { id: 1136406, name: 'Tom Holland', character: 'Peter Parker / Spider-Man', profilePath: null, order: 0 },
      { id: 505710, name: 'Zendaya', character: 'Michelle "MJ" Jones', profilePath: null, order: 1 },
      { id: 71580, name: 'Benedict Cumberbatch', character: 'Stephen Strange / Doctor Strange', profilePath: null, order: 2 },
      { id: 1649152, name: 'Jacob Batalon', character: 'Ned Leeds', profilePath: null, order: 3 },
      { id: 3131, name: 'Jon Favreau', character: 'Happy Hogan', profilePath: null, order: 4 },
      { id: 5293, name: 'Willem Dafoe', character: 'Norman Osborn / Green Goblin', profilePath: null, order: 5 },
      { id: 658, name: 'Alfred Molina', character: 'Otto Octavius / Doctor Octopus', profilePath: null, order: 6 }
    ],
    keywords: [
      { id: 9715, name: 'superhero' },
      { id: 180547, name: 'marvel cinematic universe' },
      { id: 242, name: 'new york city' },
      { id: 155030, name: 'multiverse' }
    ],
    similar: SPIDERMAN_COLLECTION.parts.filter(p => p.id !== 634649),
    recommendations: AVENGERS_COLLECTION.parts
  },
  {
    id: 157336,
    tmdbId: 157336,
    imdbId: 'tt0816692',
    title: 'Interstellar',
    overview: 'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.',
    posterPath: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdropPath: 'https://images.metahub.space/background/medium/tt0816692/img',
    releaseDate: '2014-11-05',
    voteAverage: 8.4,
    voteCount: 34500,
    popularity: 135.8,
    genres: [{ id: 12, name: 'Adventure' }, { id: 18, name: 'Drama' }, { id: 878, name: 'Science Fiction' }],
    mediaType: 'movie',
    certification: 'PG-13',
    runtime: 169,
    tagline: 'Mankind was born on Earth. It was never meant to die here.',
    status: 'Released',
    budget: 165000000,
    revenue: 701729206,
    productionCompanies: [
      { id: 923, name: 'Legendary Pictures', logoPath: null, originCountry: 'US' },
      { id: 9996, name: 'Syncopy', logoPath: null, originCountry: 'GB' },
      { id: 4, name: 'Paramount Pictures', logoPath: null, originCountry: 'US' }
    ],
    productionCountries: ['United States of America', 'United Kingdom'],
    spokenLanguages: ['English'],
    belongsToCollection: null,
    videos: [
      { id: 'v3', key: 'zSWdZVtXT7E', name: 'Interstellar Official Trailer', site: 'YouTube', type: 'Trailer', official: true }
    ],
    cast: [
      { id: 10297, name: 'Matthew McConaughey', character: 'Joseph Cooper', profilePath: null, order: 0 },
      { id: 1813, name: 'Anne Hathaway', character: 'Dr. Amelia Brand', profilePath: null, order: 1 },
      { id: 83002, name: 'Jessica Chastain', character: 'Murphy Cooper (Adult)', profilePath: null, order: 2 },
      { id: 3895, name: 'Michael Caine', character: 'Professor John Brand', profilePath: null, order: 3 }
    ],
    keywords: [
      { id: 3801, name: 'space travel' },
      { id: 9882, name: 'wormhole' },
      { id: 161176, name: 'astronaut' },
      { id: 14760, name: 'black hole' }
    ],
    similar: [],
    recommendations: []
  },
  {
    id: 155,
    tmdbId: 155,
    imdbId: 'tt0468569',
    title: 'The Dark Knight',
    overview: 'Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets.',
    posterPath: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/9FE5eD92WfVCiivM9Pq9GVSrlWk.jpg',
    releaseDate: '2008-07-16',
    voteAverage: 8.5,
    voteCount: 32000,
    popularity: 120.3,
    genres: [{ id: 18, name: 'Drama' }, { id: 28, name: 'Action' }, { id: 80, name: 'Crime' }, { id: 53, name: 'Thriller' }],
    mediaType: 'movie',
    certification: 'PG-13',
    runtime: 152,
    tagline: 'Why So Serious?',
    status: 'Released',
    budget: 185000000,
    revenue: 1004558444,
    productionCompanies: [
      { id: 174, name: 'Warner Bros. Pictures', logoPath: null, originCountry: 'US' },
      { id: 923, name: 'Legendary Pictures', logoPath: null, originCountry: 'US' },
      { id: 9996, name: 'Syncopy', logoPath: null, originCountry: 'GB' }
    ],
    productionCountries: ['United States of America', 'United Kingdom'],
    spokenLanguages: ['English', 'Mandarin'],
    belongsToCollection: {
      id: 263,
      name: 'The Dark Knight Trilogy',
      posterPath: 'https://image.tmdb.org/t/p/w500/ogyw5LTmL53dVxsppcy8Dlm30Fu.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/original/xyhrCEdB4XRkelfVsqXeUZ6rLHi.jpg',
      parts: []
    },
    videos: [
      { id: 'v4', key: 'EXeTwQWrcwY', name: 'The Dark Knight Official Trailer', site: 'YouTube', type: 'Trailer', official: true }
    ],
    cast: [
      { id: 3894, name: 'Christian Bale', character: 'Bruce Wayne / Batman', profilePath: null, order: 0 },
      { id: 1810, name: 'Heath Ledger', character: 'Joker', profilePath: null, order: 1 },
      { id: 3895, name: 'Michael Caine', character: 'Alfred Pennyworth', profilePath: null, order: 2 },
      { id: 64, name: 'Gary Oldman', character: 'James Gordon', profilePath: null, order: 3 }
    ],
    keywords: [
      { id: 849, name: 'dc comics' },
      { id: 9715, name: 'superhero' },
      { id: 416, name: 'gotham city' }
    ],
    similar: [],
    recommendations: []
  },
  {
    id: 693134,
    tmdbId: 693134,
    imdbId: 'tt15239678',
    title: 'Dune: Part Two',
    overview: 'Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a path of revenge against the conspirators who destroyed his family.',
    posterPath: 'https://image.tmdb.org/t/p/w500/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/eZ239CUp1d6OryZEBPnO2n87gMG.jpg',
    releaseDate: '2024-02-27',
    voteAverage: 8.2,
    voteCount: 5200,
    popularity: 180.4,
    genres: [{ id: 878, name: 'Science Fiction' }, { id: 12, name: 'Adventure' }],
    mediaType: 'movie',
    certification: 'PG-13',
    runtime: 166,
    tagline: 'Long live the fighters.',
    status: 'Released',
    budget: 190000000,
    revenue: 711844358,
    productionCompanies: [
      { id: 923, name: 'Legendary Pictures', logoPath: null, originCountry: 'US' },
      { id: 174, name: 'Warner Bros. Pictures', logoPath: null, originCountry: 'US' }
    ],
    productionCountries: ['United States of America', 'Canada'],
    spokenLanguages: ['English'],
    belongsToCollection: null,
    videos: [
      { id: 'v5', key: 'Way9Dexny3w', name: 'Official Trailer 3', site: 'YouTube', type: 'Trailer', official: true }
    ],
    cast: [
      { id: 1190668, name: 'Timothée Chalamet', character: 'Paul Atreides', profilePath: null, order: 0 },
      { id: 505710, name: 'Zendaya', character: 'Chani', profilePath: null, order: 1 },
      { id: 932, name: 'Rebecca Ferguson', character: 'Lady Jessica', profilePath: null, order: 2 }
    ],
    keywords: [
      { id: 4565, name: 'desert' },
      { id: 818, name: 'prophecy' },
      { id: 10403, name: 'sandworm' }
    ],
    similar: [],
    recommendations: []
  },
  {
    id: 872585,
    tmdbId: 872585,
    imdbId: 'tt15398776',
    title: 'Oppenheimer',
    overview: 'The story of J. Robert Oppenheimer\'s role in the development of the atomic bomb during World War II, examining the moral weight and political repercussions.',
    posterPath: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
    releaseDate: '2023-07-19',
    voteAverage: 8.1,
    voteCount: 9200,
    popularity: 115.6,
    genres: [{ id: 18, name: 'Drama' }, { id: 36, name: 'History' }],
    mediaType: 'movie',
    certification: 'R',
    runtime: 180,
    tagline: 'The world forever changes.',
    status: 'Released',
    budget: 100000000,
    revenue: 957000000,
    productionCompanies: [
      { id: 33, name: 'Universal Pictures', logoPath: null, originCountry: 'US' },
      { id: 9996, name: 'Syncopy', logoPath: null, originCountry: 'GB' }
    ],
    productionCountries: ['United States of America', 'United Kingdom'],
    spokenLanguages: ['English', 'German'],
    belongsToCollection: null,
    videos: [
      { id: 'v6', key: 'uYPbbksJxIg', name: 'Oppenheimer New Trailer', site: 'YouTube', type: 'Trailer', official: true }
    ],
    cast: [
      { id: 2037, name: 'Cillian Murphy', character: 'J. Robert Oppenheimer', profilePath: null, order: 0 },
      { id: 5081, name: 'Emily Blunt', character: 'Katherine "Kitty" Oppenheimer', profilePath: null, order: 1 },
      { id: 1892, name: 'Matt Damon', character: 'Leslie Groves', profilePath: null, order: 2 },
      { id: 3223, name: 'Robert Downey Jr.', character: 'Lewis Strauss', profilePath: null, order: 3 }
    ],
    keywords: [
      { id: 212, name: 'atomic bomb' },
      { id: 417, name: 'physicist' },
      { id: 295, name: 'world war ii' }
    ],
    similar: [],
    recommendations: []
  },
  {
    id: 533535,
    tmdbId: 533535,
    imdbId: 'tt6263850',
    title: 'Deadpool & Wolverine',
    overview: 'A listless Wade Wilson toils away in civilian life with his days as the morally flexible mercenary, Deadpool, behind him. But when his homeworld faces an existential threat, Wade must reluctantly suit-up again with an even more reluctant Wolverine.',
    posterPath: 'https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/by8z9Fe8y7p4jo2YlW2SZDnptyT.jpg',
    releaseDate: '2024-07-24',
    voteAverage: 7.7,
    voteCount: 4800,
    popularity: 210.5,
    genres: [{ id: 28, name: 'Action' }, { id: 35, name: 'Comedy' }, { id: 878, name: 'Science Fiction' }],
    mediaType: 'movie',
    certification: 'R',
    runtime: 128,
    tagline: 'Come together.',
    status: 'Released',
    budget: 200000000,
    revenue: 1337000000,
    productionCompanies: [
      { id: 420, name: 'Marvel Studios', logoPath: null, originCountry: 'US' },
      { id: 104228, name: 'Maximum Effort', logoPath: null, originCountry: 'US' }
    ],
    productionCountries: ['United States of America'],
    spokenLanguages: ['English'],
    belongsToCollection: null,
    videos: [
      { id: 'v7', key: '73_1biulkYk', name: 'Official Trailer', site: 'YouTube', type: 'Trailer', official: true }
    ],
    cast: [
      { id: 10859, name: 'Ryan Reynolds', character: 'Wade Wilson / Deadpool', profilePath: null, order: 0 },
      { id: 6968, name: 'Hugh Jackman', character: 'Logan / Wolverine', profilePath: null, order: 1 }
    ],
    keywords: [
      { id: 9715, name: 'superhero' },
      { id: 9823, name: 'mutant' }
    ],
    similar: [],
    recommendations: []
  },
  {
    id: 1561726,
    tmdbId: 1561726,
    imdbId: 'tt33566144',
    title: 'Masterplan',
    overview: 'When a legendary thief sets his sights on the Mona Lisa, he recruits two young strangers to help him before revealing they are long-lost siblings… and oh yes, by the way, he is their father. Thrown into a chaotic reunion they never asked for, this new family must learn to work together — and try not to kill each other — if they want any chance at pulling off the heist of the century.',
    posterPath: 'https://image.tmdb.org/t/p/w500/5xmXVd7nCK3tAo34XkO58SxUCip.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/dgUDj84BWtW6EZzee8BkgKnjDhh.jpg',
    releaseDate: '2026-10-16',
    voteAverage: 7.1,
    voteCount: 140,
    popularity: 216.4,
    genres: [{ id: 28, name: 'Action' }, { id: 53, name: 'Thriller' }, { id: 35, name: 'Comedy' }],
    mediaType: 'movie',
    certification: 'PG-13',
    runtime: 114,
    tagline: 'Family business is never simple.',
    director: 'Måns Mårlind',
    status: 'Released',
    budget: 35000000,
    revenue: 120000000,
    productionCompanies: [
      { id: 33, name: 'Universal Pictures', logoPath: null, originCountry: 'US' },
      { id: 25, name: 'TSG Entertainment', logoPath: null, originCountry: 'US' }
    ],
    productionCountries: ['United States of America', 'France'],
    spokenLanguages: ['English', 'French'],
    belongsToCollection: null,
    videos: [
      { id: 'v_mp_1', key: 'JfVOs4VSpmA', name: 'Masterplan Trailer', site: 'YouTube', type: 'Trailer', official: true }
    ],
    cast: [
      { id: 101, name: 'Vincent Cassel', character: 'Leo / The Master Thief', profilePath: null, order: 0 },
      { id: 102, name: 'Lucas Bravo', character: 'Julien', profilePath: null, order: 1 }
    ],
    keywords: [
      { id: 1001, name: 'heist' },
      { id: 1002, name: 'mona lisa' },
      { id: 1003, name: 'thief' }
    ],
    similar: [],
    recommendations: []
  }
];

// Complete TV Show catalogue with seasons and episodes
export const DETAILED_TV_SHOWS: TVDetail[] = [
  {
    id: 1396,
    tmdbId: 1396,
    imdbId: 'tt0903747',
    title: 'Breaking Bad',
    overview: 'Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years to live. He becomes filled with a sense of fearlessness and an unrelenting desire to secure his family\'s financial future.',
    posterPath: 'https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
    backdropPath: 'https://images.metahub.space/background/medium/tt0903747/img',
    releaseDate: '2008-01-20',
    voteAverage: 8.9,
    voteCount: 14800,
    popularity: 130.4,
    genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }],
    mediaType: 'tv',
    certification: 'TV-MA',
    numberOfSeasons: 5,
    numberOfEpisodes: 62,
    tagline: 'Change the equation.',
    status: 'Ended',
    productionCompanies: [
      { id: 11073, name: 'Sony Pictures Television', logoPath: null, originCountry: 'US' },
      { id: 2605, name: 'High Bridge Productions', logoPath: null, originCountry: 'US' }
    ],
    productionCountries: ['United States of America'],
    spokenLanguages: ['English', 'Spanish'],
    videos: [
      { id: 'v_bb1', key: 'HhesaQXLuRY', name: 'Breaking Bad Season 1 Trailer', site: 'YouTube', type: 'Trailer', official: true }
    ],
    cast: [
      { id: 17419, name: 'Bryan Cranston', character: 'Walter White', profilePath: null, order: 0 },
      { id: 84497, name: 'Aaron Paul', character: 'Jesse Pinkman', profilePath: null, order: 1 },
      { id: 134531, name: 'Anna Gunn', character: 'Skyler White', profilePath: null, order: 2 }
    ],
    keywords: [
      { id: 1568, name: 'chemistry' },
      { id: 596, name: 'drug lord' },
      { id: 12554, name: 'methamphetamine' }
    ],
    similar: [],
    recommendations: [],
    seasons: [
      {
        id: 3572,
        seasonNumber: 1,
        name: 'Season 1',
        overview: 'High school chemistry teacher Walter White\'s life is suddenly turned upside down when he discovers he has terminal lung cancer.',
        posterPath: 'https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
        airDate: '2008-01-20',
        episodeCount: 7,
        episodes: [
          {
            id: 62085,
            episodeNumber: 1,
            seasonNumber: 1,
            name: 'Pilot',
            overview: 'When an unassuming high school chemistry teacher discovers he has terminal lung cancer, he decides to secure his family\'s future by partnering with a former student to manufacture crystal meth.',
            stillPath: 'https://images.metahub.space/background/medium/tt0903747/img',
            airDate: '2008-01-20',
            voteAverage: 8.4,
            runtime: 58
          },
          {
            id: 62086,
            episodeNumber: 2,
            seasonNumber: 1,
            name: 'Cat\'s in the Bag...',
            overview: 'Walt and Jesse attempt to dispose of the two bodies in the RV, but things quickly go awry when Krazy-8 wakes up.',
            stillPath: 'https://images.metahub.space/background/medium/tt0903747/img',
            airDate: '2008-01-27',
            voteAverage: 8.3,
            runtime: 48
          },
          {
            id: 62087,
            episodeNumber: 3,
            seasonNumber: 1,
            name: '...And the Bag\'s in the River',
            overview: 'Walt must decide whether to kill Krazy-8 or let him live, leading to a grim realization about human nature.',
            stillPath: 'https://images.metahub.space/background/medium/tt0903747/img',
            airDate: '2008-02-10',
            voteAverage: 8.7,
            runtime: 48
          },
          {
            id: 62088,
            episodeNumber: 4,
            seasonNumber: 1,
            name: 'Cancer Man',
            overview: 'Walt finally tells his family about his cancer diagnosis at a family barbecue, while Jesse visits his estranged parents.',
            stillPath: 'https://images.metahub.space/background/medium/tt0903747/img',
            airDate: '2008-02-17',
            voteAverage: 8.2,
            runtime: 48
          }
        ]
      },
      {
        id: 3573,
        seasonNumber: 2,
        name: 'Season 2',
        overview: 'Walt and Jesse realize how dire their business has become when their distributor Tuco Salamanca takes drastic measures.',
        posterPath: 'https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
        airDate: '2009-03-08',
        episodeCount: 13,
        episodes: [
          {
            id: 62092,
            episodeNumber: 1,
            seasonNumber: 2,
            name: 'Seven Thirty-Seven',
            overview: 'Walt and Jesse realize they are in over their heads with Tuco after witnessing his violent nature firsthand.',
            stillPath: 'https://images.metahub.space/background/medium/tt0903747/img',
            airDate: '2009-03-08',
            voteAverage: 8.7,
            runtime: 48
          }
        ]
      },
      {
        id: 3574,
        seasonNumber: 3,
        name: 'Season 3',
        overview: 'Walt deals with the aftermath of the crash and his estrangement from Skyler, while two ruthless cousins seek revenge.',
        posterPath: 'https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
        airDate: '2010-03-21',
        episodeCount: 13,
        episodes: [
          {
            id: 62105,
            episodeNumber: 1,
            seasonNumber: 3,
            name: 'No Más',
            overview: 'Skyler contemplates divorce, while Walt decides to step away from the drug business. Two Mexican cartel assassins arrive.',
            stillPath: 'https://images.metahub.space/background/medium/tt0903747/img',
            airDate: '2010-03-21',
            voteAverage: 8.6,
            runtime: 47
          }
        ]
      },
      {
        id: 3575,
        seasonNumber: 4,
        name: 'Season 4',
        overview: 'Walt and Jesse find themselves in deep trouble with Gus Fring, forcing a deadly battle of wits for survival.',
        posterPath: 'https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
        airDate: '2011-07-17',
        episodeCount: 13,
        episodes: [
          {
            id: 62118,
            episodeNumber: 1,
            seasonNumber: 4,
            name: 'Box Cutter',
            overview: 'Walt and Jesse await their fate at the hands of Gus in the superlab following the climactic events of last season.',
            stillPath: 'https://images.metahub.space/background/medium/tt0903747/img',
            airDate: '2011-07-17',
            voteAverage: 9.2,
            runtime: 47
          }
        ]
      },
      {
        id: 3576,
        seasonNumber: 5,
        name: 'Season 5',
        overview: 'Walter White embraces his full Heisenberg persona, building an empire that comes with astronomical peril and consequences.',
        posterPath: 'https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
        airDate: '2012-07-15',
        episodeCount: 16,
        episodes: [
          {
            id: 62131,
            episodeNumber: 1,
            seasonNumber: 5,
            name: 'Live Free or Die',
            overview: 'Walt and Jesse work with Mike to dispose of surveillance evidence before the DEA can uncover their trail.',
            stillPath: 'https://images.metahub.space/background/medium/tt0903747/img',
            airDate: '2012-07-15',
            voteAverage: 9.3,
            runtime: 43
          }
        ]
      }
    ]
  },
  {
    id: 100088,
    tmdbId: 100088,
    imdbId: 'tt3581920',
    title: 'The Last of Us',
    overview: 'Twenty years after modern civilization has been destroyed, Joel, a hardened survivor, is hired to smuggle Ellie, a 14-year-old girl, out of an oppressive quarantine zone.',
    posterPath: 'https://image.tmdb.org/t/p/w500/dmo6TYuuJgaYinXBPjrgG9mB5od.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg',
    releaseDate: '2023-01-15',
    voteAverage: 8.6,
    voteCount: 5100,
    popularity: 145.2,
    genres: [{ id: 18, name: 'Drama' }, { id: 10765, name: 'Sci-Fi & Fantasy' }],
    mediaType: 'tv',
    certification: 'TV-MA',
    numberOfSeasons: 2,
    numberOfEpisodes: 16,
    tagline: 'When you\'re lost in the darkness, look for the light.',
    status: 'Returning Series',
    productionCompanies: [
      { id: 3268, name: 'HBO', logoPath: null, originCountry: 'US' },
      { id: 1957, name: 'Sony Pictures Television', logoPath: null, originCountry: 'US' },
      { id: 11073, name: 'Naughty Dog', logoPath: null, originCountry: 'US' }
    ],
    productionCountries: ['United States of America'],
    spokenLanguages: ['English'],
    videos: [
      { id: 'v_tlou1', key: 'uLtkt8BonwM', name: 'Official Trailer', site: 'YouTube', type: 'Trailer', official: true }
    ],
    cast: [
      { id: 1253360, name: 'Pedro Pascal', character: 'Joel Miller', profilePath: null, order: 0 },
      { id: 2058473, name: 'Bella Ramsey', character: 'Ellie Williams', profilePath: null, order: 1 }
    ],
    keywords: [
      { id: 4458, name: 'post-apocalyptic' },
      { id: 186565, name: 'fungus' },
      { id: 282, name: 'video game adaptation' }
    ],
    similar: [],
    recommendations: [],
    seasons: [
      {
        id: 144598,
        seasonNumber: 1,
        name: 'Season 1',
        overview: 'Joel and Ellie form a strong bond as they journey through the ruins of America facing infected creatures and dangerous human factions.',
        posterPath: 'https://image.tmdb.org/t/p/w500/dmo6TYuuJgaYinXBPjrgG9mB5od.jpg',
        airDate: '2023-01-15',
        episodeCount: 9,
        episodes: [
          {
            id: 2181581,
            episodeNumber: 1,
            seasonNumber: 1,
            name: 'When You\'re Lost in the Darkness',
            overview: 'Twenty years after a fungal outbreak ravages the planet, survivors Joel and Tess are tasked with a mission that could change everything.',
            stillPath: 'https://image.tmdb.org/t/p/original/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg',
            airDate: '2023-01-15',
            voteAverage: 8.7,
            runtime: 81
          },
          {
            id: 2181582,
            episodeNumber: 2,
            seasonNumber: 1,
            name: 'Infected',
            overview: 'Leaving behind their quarantine zone, Joel and Tess traverse a desolate, flooded Boston, clashing with mutated Clickers in a dilapidated museum.',
            stillPath: 'https://images.metahub.space/background/medium/tt3581920/img',
            airDate: '2023-01-22',
            voteAverage: 8.8,
            runtime: 53
          }
        ]
      }
    ]
  },
  {
    id: 126308,
    tmdbId: 126308,
    imdbId: 'tt2788316',
    title: 'Shōgun',
    overview: 'When a mysterious European ship is found marooned in a nearby fishing village, Lord Yoshii Toranaga discovers secrets that could tip the scales of power and devastate his formidable enemies in feudal Japan.',
    posterPath: 'https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg',
    backdropPath: 'https://images.metahub.space/background/medium/tt2788316/img',
    releaseDate: '2024-02-27',
    voteAverage: 8.5,
    voteCount: 1650,
    popularity: 155.1,
    genres: [{ id: 18, name: 'Drama' }, { id: 10759, name: 'Action & Adventure' }],
    mediaType: 'tv',
    certification: 'TV-MA',
    numberOfSeasons: 1,
    numberOfEpisodes: 10,
    tagline: 'Honor will cost them everything.',
    status: 'Returning Series',
    productionCompanies: [
      { id: 25120, name: 'FX Productions', logoPath: null, originCountry: 'US' }
    ],
    productionCountries: ['United States of America'],
    spokenLanguages: ['Japanese', 'English'],
    videos: [
      { id: 'v_sh1', key: 'yAN5uspAoVE', name: 'Shōgun Official Trailer', site: 'YouTube', type: 'Trailer', official: true }
    ],
    cast: [
      { id: 11180, name: 'Hiroyuki Sanada', character: 'Lord Yoshii Toranaga', profilePath: null, order: 0 },
      { id: 1395990, name: 'Cosmo Jarvis', character: 'John Blackthorne', profilePath: null, order: 1 },
      { id: 2289456, name: 'Anna Sawai', character: 'Toda Mariko', profilePath: null, order: 2 }
    ],
    keywords: [
      { id: 1416, name: 'samurai' },
      { id: 233, name: 'japan' },
      { id: 1161, name: 'feudal' }
    ],
    similar: [],
    recommendations: [],
    seasons: [
      {
        id: 197022,
        seasonNumber: 1,
        name: 'Season 1',
        overview: 'Lord Toranaga battles for survival in feudal Japan in the year 1600 as an alliance of regents conspires against him.',
        posterPath: 'https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg',
        airDate: '2024-02-27',
        episodeCount: 10,
        episodes: [
          {
            id: 3847291,
            episodeNumber: 1,
            seasonNumber: 1,
            name: 'Chapter One: Anjin',
            overview: 'Destinies converge in Japan after a barbarian ship washes ashore in a poor fishing village.',
            stillPath: 'https://images.metahub.space/background/medium/tt2788316/img',
            airDate: '2024-02-27',
            voteAverage: 8.4,
            runtime: 70
          }
        ]
      }
    ]
  }
];

// Combine all media into an expansive dataset for search & pagination
export const EXPANDED_CATALOG: MediaItem[] = [
  ...DETAILED_MOVIES,
  ...DETAILED_TV_SHOWS,
  ...SPIDERMAN_COLLECTION.parts,
  ...AVENGERS_COLLECTION.parts,
  ...HARRY_POTTER_COLLECTION.parts,
  ...PIRATES_COLLECTION.parts,
  // Additional movies to ensure multiple pages (Page 1, Page 2, Page 3) have distinct verified items
  {
    id: 27205,
    tmdbId: 27205,
    imdbId: 'tt1375666',
    title: 'Inception',
    overview: 'Cobb, a skilled thief who steals corporate secrets through the use of dream-sharing technology, is offered a chance to have his criminal history erased.',
    posterPath: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
    releaseDate: '2010-07-15',
    voteAverage: 8.4,
    voteCount: 36000,
    popularity: 110.2,
    genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }, { id: 12, name: 'Adventure' }],
    mediaType: 'movie' as MediaType,
    certification: 'PG-13',
    runtime: 148
  },
  {
    id: 558449,
    tmdbId: 558449,
    imdbId: 'tt9218128',
    title: 'Gladiator II',
    overview: 'Years after witnessing the death of the revered hero Maximus at the hands of his uncle, Lucius must enter the Colosseum after his home is conquered by the tyrannical Emperors.',
    posterPath: 'https://image.tmdb.org/t/p/w500/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg',
    backdropPath: 'https://images.metahub.space/background/medium/tt9218128/img',
    releaseDate: '2024-11-13',
    voteAverage: 7.0,
    voteCount: 2400,
    popularity: 190.4,
    genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 18, name: 'Drama' }],
    mediaType: 'movie' as MediaType,
    certification: 'R',
    runtime: 148
  },
  {
    id: 414906,
    tmdbId: 414906,
    imdbId: 'tt1877830',
    title: 'The Batman',
    overview: 'In his second year of fighting crime, Batman uncovers corruption in Gotham City that connects to his own family while facing a serial killer known as the Riddler.',
    posterPath: 'https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg',
    backdropPath: 'https://images.metahub.space/background/medium/tt1877830/img',
    releaseDate: '2022-03-01',
    voteAverage: 7.7,
    voteCount: 9500,
    popularity: 105.1,
    genres: [{ id: 80, name: 'Crime' }, { id: 9648, name: 'Mystery' }, { id: 53, name: 'Thriller' }],
    mediaType: 'movie' as MediaType,
    certification: 'PG-13',
    runtime: 176
  },
  {
    id: 66732,
    tmdbId: 66732,
    imdbId: 'tt4574334',
    title: 'Stranger Things',
    overview: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.',
    posterPath: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
    releaseDate: '2016-07-15',
    voteAverage: 8.6,
    voteCount: 17000,
    popularity: 165.7,
    genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }, { id: 18, name: 'Drama' }, { id: 9648, name: 'Mystery' }],
    mediaType: 'tv' as MediaType,
    certification: 'TV-14',
    numberOfSeasons: 4,
    numberOfEpisodes: 34
  },
  {
    id: 95396,
    tmdbId: 95396,
    imdbId: 'tt11280740',
    title: 'Severance',
    overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives. When a mysterious colleague appears outside of work, it begins a journey to discover the truth.',
    posterPath: 'https://image.tmdb.org/t/p/w500/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg',
    backdropPath: 'https://images.metahub.space/background/medium/tt11280740/img',
    releaseDate: '2022-02-17',
    voteAverage: 8.4,
    voteCount: 2100,
    popularity: 92.4,
    genres: [{ id: 18, name: 'Drama' }, { id: 9648, name: 'Mystery' }, { id: 10765, name: 'Sci-Fi & Fantasy' }],
    mediaType: 'tv' as MediaType,
    certification: 'TV-MA',
    numberOfSeasons: 2,
    numberOfEpisodes: 19
  },
  {
    id: 94605,
    tmdbId: 94605,
    imdbId: 'tt11126994',
    title: 'Arcane',
    overview: 'Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war between magic technologies and incompatible convictions.',
    posterPath: 'https://image.tmdb.org/t/p/w500/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg',
    backdropPath: 'https://images.metahub.space/background/medium/tt11126994/img',
    releaseDate: '2021-11-06',
    voteAverage: 8.7,
    voteCount: 4100,
    popularity: 140.8,
    genres: [{ id: 16, name: 'Animation' }, { id: 10765, name: 'Sci-Fi & Fantasy' }, { id: 10759, name: 'Action & Adventure' }],
    mediaType: 'tv' as MediaType,
    certification: 'TV-14',
    numberOfSeasons: 2,
    numberOfEpisodes: 18
  },
  {
    id: 94997,
    tmdbId: 94997,
    imdbId: 'tt11198330',
    title: 'House of the Dragon',
    overview: 'The Targaryen dynasty is at the absolute apex of its power, with more than 15 dragons under their yoke. Most empires crumble from such heights. In the case of the Targaryens, their slow fall begins when King Viserys breaks with a century of tradition by naming his daughter Rhaenyra heir.',
    posterPath: 'https://image.tmdb.org/t/p/w500/7QMsOTMUswlwxJP0rTTZfmz2tX2.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/etj8E2o0Bud0HkONVQPjyCkIvpv.jpg',
    releaseDate: '2022-08-21',
    voteAverage: 8.4,
    voteCount: 4600,
    popularity: 175.3,
    genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }, { id: 18, name: 'Drama' }, { id: 10759, name: 'Action & Adventure' }],
    mediaType: 'tv' as MediaType,
    certification: 'TV-MA',
    numberOfSeasons: 2,
    numberOfEpisodes: 18
  },
  // Verified distinct curated titles with unique artwork & tag coverage
  {
    id: 120,
    tmdbId: 120,
    imdbId: 'tt0120737',
    title: 'The Lord of the Rings: The Fellowship of the Ring',
    overview: 'Young hobbit Frodo Baggins, after inheriting a mysterious ring from his uncle Bilbo, must leave his home in order to keep it from falling into the hands of its evil creator.',
    posterPath: 'https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/oiwc338EoBgS4sEI2ixAny4KQKg.jpg',
    releaseDate: '2001-12-18',
    voteAverage: 8.4,
    voteCount: 28722,
    popularity: 180.2,
    genres: [{ id: 12, name: 'Adventure' }, { id: 14, name: 'Fantasy' }, { id: 28, name: 'Action' }],
    mediaType: 'movie' as MediaType,
    certification: 'PG-13',
    runtime: 178,
    keywords: [{ id: 1, name: 'witch' }, { id: 2, name: 'magic' }, { id: 3, name: 'friendship' }, { id: 4, name: 'based on novel or book' }]
  },
  {
    id: 245891,
    tmdbId: 245891,
    imdbId: 'tt2911666',
    title: 'John Wick',
    overview: 'Ex-hitman John Wick comes out of retirement to track down the gangsters that took everything from him.',
    posterPath: 'https://image.tmdb.org/t/p/w500/wXqWR7dHncNRbxoEGybEy7QTe9h.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/ff2ti5DkA9UYLzyqhQfI2kZqEuh.jpg',
    releaseDate: '2014-10-16',
    voteAverage: 7.5,
    voteCount: 19400,
    popularity: 172.5,
    genres: [{ id: 28, name: 'Action' }, { id: 53, name: 'Thriller' }, { id: 80, name: 'Crime' }],
    mediaType: 'movie' as MediaType,
    certification: 'R',
    runtime: 101,
    keywords: [{ id: 5, name: 'revenge' }, { id: 6, name: 'based on novel or book' }]
  },
  {
    id: 105,
    tmdbId: 105,
    imdbId: 'tt0088763',
    title: 'Back to the Future',
    overview: 'Eighties teenager Marty McFly is accidentally sent back in time to 1955, inadvertently disrupting his parents\' first meeting, and must return to 1985.',
    posterPath: 'https://image.tmdb.org/t/p/w500/vN5B5WgYscRGcQpVhHl6p9DDTP0.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/5bzPWQ2dFUl2aZKkp7ILJVVkRed.jpg',
    releaseDate: '1985-07-03',
    voteAverage: 8.3,
    voteCount: 22670,
    popularity: 215.3,
    genres: [{ id: 12, name: 'Adventure' }, { id: 35, name: 'Comedy' }, { id: 878, name: 'Science Fiction' }],
    mediaType: 'movie' as MediaType,
    certification: 'PG',
    runtime: 116,
    keywords: [{ id: 7, name: 'time travel' }, { id: 8, name: 'coming of age' }, { id: 9, name: 'school friend' }]
  },
  {
    id: 284053,
    tmdbId: 284053,
    imdbId: 'tt3501632',
    title: 'Thor: Ragnarok',
    overview: 'Thor is imprisoned on the other side of the universe and finds himself in a race against time to get back to Asgard to stop Ragnarok, the destruction of his homeworld.',
    posterPath: 'https://image.tmdb.org/t/p/w500/rzRwTcFvttcN1ZpX2xv4j3tSdJu.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/vLmHH8jAy8Jq8uBsLucd3592WGh.jpg',
    releaseDate: '2017-10-24',
    voteAverage: 7.6,
    voteCount: 21200,
    popularity: 195.4,
    genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 878, name: 'Science Fiction' }],
    mediaType: 'movie' as MediaType,
    certification: 'PG-13',
    runtime: 130,
    keywords: [{ id: 10, name: 'superhero' }, { id: 11, name: 'based on comic book' }, { id: 12, name: 'sequel' }]
  },
  {
    id: 11,
    tmdbId: 11,
    imdbId: 'tt0076759',
    title: 'Star Wars',
    overview: 'Princess Leia is captured and held hostage by the evil Imperial forces in their effort to take over the galactic Empire. Venturesome Luke Skywalker and Captain Han Solo team up to rescue her.',
    posterPath: 'https://image.tmdb.org/t/p/w500/fai0rspsNeJCS69wHNjOdWxcI7P.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/zqkmTXzjkAgXmEWLRsY4UpTWCeo.jpg',
    releaseDate: '1977-05-25',
    voteAverage: 8.2,
    voteCount: 20500,
    popularity: 168.1,
    genres: [{ id: 12, name: 'Adventure' }, { id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }],
    mediaType: 'movie' as MediaType,
    certification: 'PG',
    runtime: 121,
    keywords: [{ id: 13, name: 'space' }, { id: 14, name: 'friendship' }]
  },
  {
    id: 603,
    tmdbId: 603,
    imdbId: 'tt0133093',
    title: 'The Matrix',
    overview: 'Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.',
    posterPath: 'https://image.tmdb.org/t/p/w500/dXNAPwY7VrqMAo51EKhhCJfaGb5.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/tlm8UkiQsitc8rSuIAscQDCnP8d.jpg',
    releaseDate: '1999-03-31',
    voteAverage: 8.3,
    voteCount: 29101,
    popularity: 175.0,
    genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }, { id: 53, name: 'Thriller' }],
    mediaType: 'movie' as MediaType,
    certification: 'R',
    runtime: 136,
    keywords: [{ id: 15, name: 'space' }, { id: 16, name: 'revenge' }]
  },
  {
    id: 329,
    tmdbId: 329,
    imdbId: 'tt0107290',
    title: 'Jurassic Park',
    overview: 'A wealthy entrepreneur secretly creates a theme park featuring living dinosaurs drawn from prehistoric DNA. Before opening day, security systems go off-line and the dinosaurs escape.',
    posterPath: 'https://image.tmdb.org/t/p/w500/d9mtMGQDLANKieb9PbD3yK7xxzo.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/original/4SyDTF02R5BepqSdQmOaNCHObzF.jpg',
    releaseDate: '1993-06-11',
    voteAverage: 8.0,
    voteCount: 18546,
    popularity: 162.4,
    genres: [{ id: 12, name: 'Adventure' }, { id: 878, name: 'Science Fiction' }, { id: 53, name: 'Thriller' }],
    mediaType: 'movie' as MediaType,
    certification: 'PG-13',
    runtime: 127,
    keywords: [{ id: 17, name: 'based on novel or book' }, { id: 18, name: 'friendship' }]
  }
].filter((item, index, self) => index === self.findIndex((t) => t.id === item.id));

export interface PopularTagItem {
  id: string;
  name: string;
  countText: string;
}

export const POPULAR_TAGS: PopularTagItem[] = [
  { id: 'witch', name: 'witch', countText: 'Explore matching movies →' },
  { id: 'magic', name: 'magic', countText: 'Explore matching movies →' },
  { id: 'time travel', name: 'time travel', countText: 'Explore matching movies →' },
  { id: 'based on novel or book', name: 'based on novel or book', countText: 'Explore matching movies →' },
  { id: 'friendship', name: 'friendship', countText: 'Explore matching movies →' },
  { id: 'school friend', name: 'school friend', countText: 'Explore matching movies →' },
  { id: 'sequel', name: 'sequel', countText: 'Explore matching movies →' },
  { id: 'space', name: 'space', countText: 'Explore matching movies →' },
  { id: 'revenge', name: 'revenge', countText: 'Explore matching movies →' },
  { id: 'superhero', name: 'superhero', countText: 'Explore matching movies →' },
  { id: 'based on comic book', name: 'based on comic book', countText: 'Explore matching movies →' },
  { id: 'coming of age', name: 'coming of age', countText: 'Explore matching movies →' }
];

