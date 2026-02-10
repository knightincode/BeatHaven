import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

interface FavoriteTrack {
  id: string;
  trackId: string;
}

export function useFavorites() {
  const { isAuthenticated } = useAuth();

  const { data: favorites = [], isLoading } = useQuery<FavoriteTrack[]>({
    queryKey: ["/api/favorites"],
    enabled: isAuthenticated,
  });

  const favoriteTrackIds = new Set(favorites.map((f) => f.trackId));

  const addFavorite = useMutation({
    mutationFn: async (trackId: string) => {
      await apiRequest("POST", `/api/favorites/${trackId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  const removeFavorite = useMutation({
    mutationFn: async (trackId: string) => {
      await apiRequest("DELETE", `/api/favorites/${trackId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  function toggleFavorite(trackId: string) {
    if (favoriteTrackIds.has(trackId)) {
      removeFavorite.mutate(trackId);
    } else {
      addFavorite.mutate(trackId);
    }
  }

  function isFavorite(trackId: string) {
    return favoriteTrackIds.has(trackId);
  }

  return {
    favorites,
    isLoading,
    toggleFavorite,
    isFavorite,
  };
}
