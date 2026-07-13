export interface MplusSeasonIndex {
	season_id: string;
	label: string;
	start_date: string;
	end_date: string | null;
}

export interface RaidZoneIndex {
	season_id: string;
	label: string;
	wcl_zone_id: number;
	start_date: string;
	end_date: string | null;
}

export interface SeasonsIndex {
	active_mplus_season: string | null;
	active_raid_zones: string[];
	all_mplus_seasons: MplusSeasonIndex[];
	all_raid_zones: RaidZoneIndex[];
	raiding_break?: { active: boolean; message: string; note?: string | null };
}
