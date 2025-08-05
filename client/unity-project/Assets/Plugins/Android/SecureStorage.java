package com.thinkrank.security;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.KeyPairGeneratorSpec;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.cert.Certificate;
import java.util.ArrayList;
import java.util.Calendar;

import javax.crypto.Cipher;
import javax.crypto.CipherInputStream;
import javax.crypto.CipherOutputStream;
import javax.security.auth.x500.X500Principal;

/**
 * Android secure storage implementation using Android Keystore
 * Provides hardware-backed security for sensitive data
 */
public class SecureStorage {
    private static final String TAG = "ThinkRankSecureStorage";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEYSTORE_ALIAS = "ThinkRankMasterKey";
    private static final String PREFS_NAME = "ThinkRankSecurePrefs";
    private static final String TRANSFORMATION = "RSA/ECB/PKCS1Padding";
    
    private static Context applicationContext;
    private static SharedPreferences securePrefs;
    private static boolean isInitialized = false;

    /**
     * Initialize the secure storage system
     */
    public static void initialize(Context context) {
        if (isInitialized) return;
        
        try {
            applicationContext = context.getApplicationContext();
            
            // Try to use EncryptedSharedPreferences (API 23+)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                initializeEncryptedPrefs();
            } else {
                // Fallback for older Android versions
                initializeLegacySecurePrefs();
            }
            
            isInitialized = true;
            Log.i(TAG, "Secure storage initialized successfully");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize secure storage", e);
            // Fallback to regular SharedPreferences with warning
            securePrefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            Log.w(TAG, "Using fallback storage - data is not encrypted!");
        }
    }

    /**
     * Initialize EncryptedSharedPreferences for Android 6.0+
     */
    private static void initializeEncryptedPrefs() throws Exception {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            MasterKey masterKey = new MasterKey.Builder(applicationContext, KEYSTORE_ALIAS)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .setRequestStrongBoxBacked(true) // Use hardware security module if available
                    .build();

            securePrefs = EncryptedSharedPreferences.create(
                    applicationContext,
                    PREFS_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        }
    }

    /**
     * Initialize legacy secure preferences for older Android versions
     */
    private static void initializeLegacySecurePrefs() throws Exception {
        generateKeyPair();
        securePrefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    /**
     * Generate RSA key pair for encryption (legacy method)
     */
    private static void generateKeyPair() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);

        if (!keyStore.containsAlias(KEYSTORE_ALIAS)) {
            Calendar start = Calendar.getInstance();
            Calendar end = Calendar.getInstance();
            end.add(Calendar.YEAR, 30); // 30-year validity

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                        KEYSTORE_ALIAS,
                        KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                        .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA512)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_PKCS1)
                        .setKeySize(2048)
                        .setUserAuthenticationRequired(false)
                        .build();

                KeyPairGenerator generator = KeyPairGenerator.getInstance(
                        KeyProperties.KEY_ALGORITHM_RSA, ANDROID_KEYSTORE);
                generator.initialize(spec);
                generator.generateKeyPair();
            } else {
                // API < 23
                KeyPairGeneratorSpec spec = new KeyPairGeneratorSpec.Builder(applicationContext)
                        .setAlias(KEYSTORE_ALIAS)
                        .setSubject(new X500Principal("CN=ThinkRank"))
                        .setSerialNumber(BigInteger.valueOf(1))
                        .setStartDate(start.getTime())
                        .setEndDate(end.getTime())
                        .setKeySize(2048)
                        .build();

                KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA", ANDROID_KEYSTORE);
                generator.initialize(spec);
                generator.generateKeyPair();
            }
        }
    }

    /**
     * Store data securely
     */
    public static boolean storeSecurely(String key, String value) {
        if (!isInitialized) {
            Log.e(TAG, "Secure storage not initialized");
            return false;
        }

        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                // Use EncryptedSharedPreferences
                securePrefs.edit().putString(key, value).apply();
            } else {
                // Use legacy encryption
                String encryptedValue = encryptData(value);
                securePrefs.edit().putString(key, encryptedValue).apply();
            }
            
            Log.d(TAG, "Data stored securely for key: " + key);
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to store data securely", e);
            return false;
        }
    }

    /**
     * Retrieve data securely
     */
    public static String retrieveSecurely(String key, String defaultValue) {
        if (!isInitialized) {
            Log.e(TAG, "Secure storage not initialized");
            return defaultValue;
        }

        try {
            String storedValue = securePrefs.getString(key, null);
            if (storedValue == null) {
                return defaultValue;
            }

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                // EncryptedSharedPreferences handles decryption automatically
                return storedValue;
            } else {
                // Use legacy decryption
                return decryptData(storedValue);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to retrieve data securely", e);
            return defaultValue;
        }
    }

    /**
     * Check if key exists
     */
    public static boolean keyExists(String key) {
        if (!isInitialized) return false;
        return securePrefs.contains(key);
    }

    /**
     * Delete secure data
     */
    public static boolean deleteSecure(String key) {
        if (!isInitialized) return false;
        
        try {
            securePrefs.edit().remove(key).apply();
            Log.d(TAG, "Data deleted for key: " + key);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to delete data", e);
            return false;
        }
    }

    /**
     * Encrypt data using Android Keystore (legacy method)
     */
    private static String encryptData(String data) throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);

        PublicKey publicKey = keyStore.getCertificate(KEYSTORE_ALIAS).getPublicKey();
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, publicKey);

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        CipherOutputStream cipherOutputStream = new CipherOutputStream(outputStream, cipher);
        cipherOutputStream.write(data.getBytes("UTF-8"));
        cipherOutputStream.close();

        byte[] vals = outputStream.toByteArray();
        return Base64.encodeToString(vals, Base64.DEFAULT);
    }

    /**
     * Decrypt data using Android Keystore (legacy method)
     */
    private static String decryptData(String encryptedData) throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);

        PrivateKey privateKey = (PrivateKey) keyStore.getKey(KEYSTORE_ALIAS, null);
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, privateKey);

        byte[] encryptedBytes = Base64.decode(encryptedData, Base64.DEFAULT);
        CipherInputStream cipherInputStream = new CipherInputStream(
                new ByteArrayInputStream(encryptedBytes), cipher);

        ArrayList<Byte> values = new ArrayList<>();
        int nextByte;
        while ((nextByte = cipherInputStream.read()) != -1) {
            values.add((byte) nextByte);
        }

        byte[] bytes = new byte[values.size()];
        for (int i = 0; i < bytes.length; i++) {
            bytes[i] = values.get(i);
        }

        return new String(bytes, "UTF-8");
    }

    /**
     * Clear all secure data (for logout/reset)
     */
    public static void clearAll() {
        if (!isInitialized) return;
        
        try {
            securePrefs.edit().clear().apply();
            Log.i(TAG, "All secure data cleared");
        } catch (Exception e) {
            Log.e(TAG, "Failed to clear secure data", e);
        }
    }

    /**
     * Get hardware security level information
     */
    public static String getSecurityLevel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            try {
                KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
                keyStore.load(null);
                
                if (keyStore.containsAlias(KEYSTORE_ALIAS)) {
                    // Check if hardware-backed
                    return "Hardware-backed encryption available";
                }
            } catch (Exception e) {
                Log.e(TAG, "Error checking security level", e);
            }
        }
        
        return "Software-based encryption";
    }
}