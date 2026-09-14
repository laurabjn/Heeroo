export const theme = {
  FONT_ONE: 'Montserrat-Bold',
  FONT_SIZE_BUTTONS: 18,
  BUTTON_BLUE: '#47668B',
  BUTTON_SKY: 'rgba(57,137,233,1)',
  BUTTON_YELLOW: '#F9C667',
  BUTTON_PRIMARY: '#1E81D3',
  BUTTON_TEXT: '#fff',
};

export const colors = {
  TRANSPARENT: 'transparent',
  WHITE: '#fff',
  BLACK: '#000',
  RED: 'red',
  SKY: '#1E81D3',
  DARK: "#070807",
  DEEP_SKY: "#0370bc",
  LIGHT_RED: "#FF2121",

  GREY: {
    default: '#243235',
    primary: "#f5f1f1",
    secondary: "#9b9b9b",
    btnPrimary: '#666666',
    btnSecondary: "#ababab",
    iconPrimary: "#c8c8c8",
    iconSecondary: "#3d3d3d",
    background: "rgba(22,22,22,0.8)",
    Smoke_Grey: "#dcdcdc",
    Trolley_Grey: "#808080",
    border: "#d6d6d6",
    Deep_Nobel: "#9f9f9f",
    whiteish: "#E5E3E3",
  },
  BLUE: {
    default: "blue",
    primary: "rgba(111, 202, 186, 1)",
    secondary: "#007aff",
    light: "#8ec4e6",
    dark: "#111b1e",
    sky: "#4a90e2",
    Deep_Blue: "#0386e1",
  },
  YELLOW: {
    primary: "#fda33b",
    secondary: "#ffe446",
    light: "#dbd6a0"
  },
  GREEN: {
    default: "green",
    background: "#2e342d",
    light: "#32db64",
  },
  //
  PRIMARY: "#181717",
  PRIMARYTRANSPARENT: "rgba(0, 0, 0, 0.15)",
  SECONDARY: "rgba(27, 75, 112,1)",
  DRAWER_BG: "rgba(0, 0, 0, 1)",
  DRAWER_BG_ANDROID: "rgba(0, 0, 0, 0.95)",
  DRAWER_TEXT: "#ffffff",
  SEPARATOR: "#e2e6ec",
  DANGER: "#f15a6e",
  ITEM: "#f4f4f5",
  SEPARATOR_LIGHT: "#d8d8d8",
  HOLDER_TEXT: "#b3c9db",
  TEXT_DARK: "#161533",
  TEXT: "#143955",
  TEXT_LIGHT: "#1b4b70",
  TEXT_SEMI_DARKER: "#194669",
  BUTTON_TEXT: "white"
}


export const customMapStyle = [
  {
    "featureType": "administrative",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#444444"
      }
    ]
  },
  {
    "featureType": "landscape",
    "stylers": [
      {
        "color": "#f2f2f2"
      }
    ]
  },
  {
    "featureType": "poi",
    "stylers": [
      {
        "visibility": "on"
      },
      {
        "weight": 1
      }
    ]
  },
  {
    "featureType": "road",
    "stylers": [
      {
        "saturation": -100
      },
      {
        "lightness": 45
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "stylers": [
      {
        "visibility": "simplified"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "transit",
    "stylers": [
      {
        "visibility": "on"
      }
    ]
  },
  {
    "featureType": "water",
    "stylers": [
      {
        "color": "#dde6e8"
      },
      {
        "visibility": "on"
      }
    ]
  }
]