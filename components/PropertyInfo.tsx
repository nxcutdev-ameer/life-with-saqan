import React from 'react';
import { Text, View } from 'react-native';
import { MapPin, Bed, Bath, Ruler } from 'lucide-react-native';
import { Property } from '@/types';
import { formatCompactNumber, formatPrice, formatLocation } from '@/utils/formatters';
import { feedStyles as styles } from '@/constants/feedStyles';

interface PropertyInfoProps {
  item: Property;
  translationContent?: {
    agentName: string;
    translation: string;
  } | null;
}

/**
 * Displays property details including title, price, location, and amenities
 * Shown in the left section of the property footer
 */
export default function PropertyInfo({ item, translationContent }: PropertyInfoProps) {
  return (
    <View style={styles.footerLeftContent}>
      {translationContent && (
        <View style={styles.translationContainer}>
          <Text
            style={styles.translationText}
            numberOfLines={1}
            // Prevent Android system font scaling from making this look larger than intended.
            allowFontScaling={false}
          >
            {translationContent.translation}
          </Text>
        </View>
      )}
      
      <Text style={styles.footerTitle} numberOfLines={2}>
        {item.title}
      </Text>
      
      <Text style={styles.footerPrice}>
        {item.type === 'offplan' && item.priceTo && item.priceTo > item.price
          ? `${item.currency} ${formatCompactNumber(item.price)}–${formatCompactNumber(item.priceTo)}`
          : formatPrice(item.price, item.currency, item.listingType)}
        {item.defaultPricing ? `/${item.defaultPricing}` : ''}
      </Text>
      
      <View style={styles.footerLocationRow}>
        <MapPin size={10} color="#FFFFFF" fill="#FFFFFF" />
        <Text style={styles.footerSmallText} numberOfLines={1}>
          {formatLocation(item.location.area, item.location.city)}
        </Text>
      </View>
      
      <View style={styles.footerDetailsRow}>
        <View style={styles.footerDetailItem}>
          <Bed size={14} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.footerSmallText}>{item.bedrooms}</Text>
        </View>
        <View style={styles.footerDetailItem}>
          <Bath size={14} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.footerSmallText}>{item.bathrooms}</Text>
        </View>
        <View style={styles.footerDetailItem}>
          <Ruler size={14} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.footerSmallText}>
            {item.sizeSqft
              ? item.type === 'offplan' && item.sizeSqftTo && item.sizeSqftTo > item.sizeSqft
                ? `${item.sizeSqft.toLocaleString()}–${item.sizeSqftTo.toLocaleString()} sqft`
                : `${item.sizeSqft.toLocaleString()} sqft`
              : '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}
