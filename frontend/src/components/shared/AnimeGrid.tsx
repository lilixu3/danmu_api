import { Card, CardContent } from "@/components/ui/card";
import type { DanmuAnime, DanmuEpisode } from "@/lib/api";

export function AnimeGrid({
  animes,
  onSelect,
}: {
  animes: DanmuAnime[];
  onSelect: (anime: DanmuAnime) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {animes.map((anime) => (
        <Card
          key={anime.animeId}
          className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
          onClick={() => onSelect(anime)}
        >
          <div className="aspect-[3/4] overflow-hidden bg-muted">
            <img
              src={anime.imageUrl || "https://placehold.co/150x200?text=No+Image"}
              alt={anime.animeTitle}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <CardContent className="p-2">
            <h4 className="line-clamp-2 text-xs font-semibold">{anime.animeTitle}</h4>
            <p className="text-xs text-muted-foreground">共 {anime.episodeCount} 集</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function EpisodeList({
  episodes,
  title,
  onSelect,
  onBack,
}: {
  episodes: DanmuEpisode[];
  title: string;
  onSelect: (episode: DanmuEpisode) => void;
  onBack?: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="text-sm text-primary hover:underline">
            返回
          </button>
        )}
        <h3 className="font-semibold">{title}</h3>
        <span className="text-sm text-muted-foreground">共 {episodes.length} 集</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {episodes.map((ep) => (
          <Card
            key={ep.episodeId}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => onSelect(ep)}
          >
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <div className="font-semibold">第 {ep.episodeNumber} 集</div>
                <div className="text-sm text-muted-foreground line-clamp-1">{ep.episodeTitle}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
