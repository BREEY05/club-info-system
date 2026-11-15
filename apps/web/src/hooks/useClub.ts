import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clubKeys, fetchClub, updateClub, type ClubPatch } from '../api/club';

export function useClub() {
  return useQuery({ queryKey: clubKeys.all, queryFn: fetchClub, staleTime: 60_000 });
}

export function useUpdateClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ClubPatch) => updateClub(patch),
    onSuccess: (club) => {
      queryClient.setQueryData(clubKeys.all, club);
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
