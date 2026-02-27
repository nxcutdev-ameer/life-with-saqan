import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import CountryPicker, { Country, CountryCode } from 'react-native-country-picker-modal';

import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';

export type PhoneFieldChange = {
  countryCode: CountryCode;
  callingCode: string;
  phone: string; // digits-only local part
  formattedPhone: string; // +<callingCode><phone>
  isValid: boolean;
  error: string | null;
};

export function validatePhoneForNow(phoneDigits: string, callingCode: string): string | null {
  const localDigits = (phoneDigits || '').replace(/[^0-9]/g, '');
  const codeDigits = (callingCode || '').replace(/[^0-9]/g, '');
  const fullDigits = `${codeDigits}${localDigits}`;

  if (!localDigits) return 'Please enter your mobile number.';

  // UAE-specific validation for now.
  // Common UAE mobile format: +971 5X XXX XXXX (9 digits after country code, starts with 5)
  if (codeDigits === '971') {
    if (localDigits.startsWith('0')) return 'Remove the leading 0 from your mobile number.';
    if (localDigits.length !== 9) return 'mobile number must be 9 digits.';
    if (!localDigits.startsWith('5')) return 'mobile number must start with 5.';
    return null;
  }

  // Generic fallback validation
  if (localDigits.length < 8) return 'Mobile number is too short.';
  if (localDigits.length > 15) return 'Mobile number is too long.';
  // E.164 max is 15 digits excluding the plus.
  if (fullDigits.length > 15) return 'Phone number is too long for the selected country code.';

  return null;
}

export type PhoneFieldProps = {
  label?: string;
  defaultCountryCode?: CountryCode;
  defaultCallingCode?: string;
  placeholder?: string;
  value?: string; // digits-only
  onChangeValue?: (digitsOnly: string) => void;
  onChange?: (value: PhoneFieldChange) => void;
};

export function PhoneField({
  label = 'Mobile Number',
  defaultCountryCode = 'AE',
  defaultCallingCode = '971',
  placeholder = '50 123 4567',
  value,
  onChangeValue,
  onChange,
}: PhoneFieldProps) {
  const [countryCode, setCountryCode] = useState<CountryCode>(defaultCountryCode);
  const [callingCode, setCallingCode] = useState<string>(defaultCallingCode);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [touched, setTouched] = useState(false);

  const phone = value ?? '';

  const formattedPhone = useMemo(() => {
    const digits = phone.replace(/[^0-9]/g, '');
    const codeDigits = (callingCode || '').replace(/[^0-9]/g, '');
    return codeDigits ? `+${codeDigits}${digits}` : digits;
  }, [callingCode, phone]);

  const error = useMemo(() => validatePhoneForNow(phone, callingCode), [phone, callingCode]);
  const isValid = useMemo(() => error == null, [error]);

  useEffect(() => {
    onChange?.({
      countryCode,
      callingCode,
      phone,
      formattedPhone,
      isValid,
      error,
    });
  }, [countryCode, callingCode, phone, formattedPhone, isValid, error, onChange]);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.phoneRow}>
        <Pressable
          style={styles.countryBox}
          onPress={() => setCountryPickerVisible(true)}
          accessibilityRole="button"
        >
          <CountryPicker
            countryCode={countryCode}
            visible={countryPickerVisible}
            withFilter
            withFlag
            withCallingCode
            withCallingCodeButton={false}
            withCountryNameButton={false}
            withAlphaFilter
            withEmoji={false}
            onClose={() => setCountryPickerVisible(false)}
            onSelect={(c: Country) => {
              setCountryPickerVisible(false);
              setCountryCode(c.cca2);
              const cc = Array.isArray(c.callingCode) ? c.callingCode[0] : (c.callingCode as any);
              if (cc) setCallingCode(String(cc));
            }}
            containerButtonStyle={styles.countryPickerButton}
          />
          <Text style={styles.callingCodeText}>+{callingCode}</Text>
        </Pressable>

        <TextInput
          style={styles.phoneInput}
          value={phone}
          onBlur={() => setTouched(true)}
          onChangeText={(t) => {
            const digitsOnly = t.replace(/[^0-9]/g, '');
            onChangeValue?.(digitsOnly);
          }}
          keyboardType="number-pad"
          maxLength={15}
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {touched && error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: Platform.OS === 'android' ? scaleFont(10) : scaleFont(14),
    fontWeight: '700',
    color: Colors.text,
  },
  phoneRow: {
    width: '100%',
    height: scaleHeight(52),
    flexDirection: 'row',
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    marginTop: scaleHeight(10),
  },
  countryBox: {
    width: scaleWidth(100),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: scaleWidth(10),
    //gap: scaleWidth(8),
  },
  countryPickerButton: {
    padding: 0,
    margin: 0,
  },
  callingCodeText: {
    color: Colors.text,
    fontSize: Platform.OS === 'android' ? scaleFont(12) : scaleFont(15),
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    height: scaleHeight(52),
    paddingHorizontal: scaleWidth(14),
    color: Colors.text,
    fontSize: Platform.OS === 'android' ? scaleFont(12) : scaleFont(15),
  },
  errorText: {
    marginTop: scaleHeight(8),
    color: (Colors as any).error ?? '#C62828',
     fontSize: Platform.OS === 'android' ? scaleFont(11) : scaleFont(13),
    fontWeight: '600',
  },
});
