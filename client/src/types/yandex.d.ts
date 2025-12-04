declare global {
  interface Window {
    ymaps: any;
  }
}

export interface YMapsApi {
  Map: any;
  Placemark: any;
  Clusterer: any;
  ready: (callback: () => void) => void;
}

export {};
