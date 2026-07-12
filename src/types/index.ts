export interface Client {
  id: string;
  name?: string;
  street: string;
  number: string;
  bloc?: string;
  apartment?: string;
  lat: number;
  lng: number;
  phone?: string;
  notes?: string;
  tags?: string[];
}

export interface Stop {
  id: string;
  clientId: string;
  menuItemId: string;
  position: number;
  status: "pending" | "delivered" | "skipped";
  notes?: string;
  completedAt?: string;
  isWalkIn: boolean;
  walkInName?: string;
  walkInStreet?: string;
  walkInNumber?: string;
  walkInBloc?: string;
  walkInApartment?: string;
  walkInLat?: number;
  walkInLng?: number;
  walkInPhone?: string;
  sectionId?: string;
}

export interface ManifestSection {
  id: string;
  name: string;
  timeFrom: string;
  timeTo: string;
  position: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  date: string;
}

export interface DailyManifest {
  id: string;
  date: string;
  stops: Stop[];
  sections: ManifestSection[];
}
