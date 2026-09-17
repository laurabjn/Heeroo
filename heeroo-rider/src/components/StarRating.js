// Adaptateur : même props que l'ancien react-native-star-rating (abandonné),
// rendu par react-native-star-rating-widget.
import React from 'react';
import StarRatingWidget from 'react-native-star-rating-widget';

export default function StarRating({
  rating = 0,
  maxStars = 5,
  starSize = 24,
  fullStarColor = '#fed428',
  emptyStarColor = '#727e8b',
  disabled = false,
  selectedStar,
  containerStyle,
}) {
  return (
    <StarRatingWidget
      rating={Number(rating) || 0}
      maxStars={maxStars}
      starSize={starSize}
      color={fullStarColor}
      emptyColor={emptyStarColor}
      enableHalfStar={false}
      enableSwiping={!disabled}
      onChange={(value) => { if (!disabled && selectedStar) selectedStar(value); }}
      // Étoiles serrées comme l'ancienne bibliothèque ; centrées par défaut,
      // le conteneur de l'écran peut surcharger (alignSelf, marges…)
      starStyle={{ marginHorizontal: disabled ? 1 : 4 }}
      style={[{ alignSelf: 'center' }, containerStyle]}
    />
  );
}
