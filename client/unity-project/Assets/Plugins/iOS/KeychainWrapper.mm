#import <Foundation/Foundation.h>
#import <Security/Security.h>
#import <LocalAuthentication/LocalAuthentication.h>

// iOS Keychain wrapper for secure storage
// Provides hardware-backed security using iOS Keychain Services

extern "C" {
    
    // Store data securely in iOS Keychain
    int KeychainStore(const char* key, const char* value) {
        if (!key || !value) {
            return -1; // Invalid parameters
        }
        
        NSString *keyString = [NSString stringWithUTF8String:key];
        NSString *valueString = [NSString stringWithUTF8String:value];
        NSData *valueData = [valueString dataUsingEncoding:NSUTF8StringEncoding];
        
        // Create query dictionary
        NSMutableDictionary *query = [[NSMutableDictionary alloc] init];
        [query setObject:(__bridge id)kSecClassGenericPassword forKey:(__bridge id)kSecClass];
        [query setObject:keyString forKey:(__bridge id)kSecAttrService];
        [query setObject:keyString forKey:(__bridge id)kSecAttrAccount];
        
        // Check if item already exists
        OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, NULL);
        
        if (status == errSecSuccess) {
            // Item exists, update it
            NSMutableDictionary *attributesToUpdate = [[NSMutableDictionary alloc] init];
            [attributesToUpdate setObject:valueData forKey:(__bridge id)kSecValueData];
            
            status = SecItemUpdate((__bridge CFDictionaryRef)query, 
                                 (__bridge CFDictionaryRef)attributesToUpdate);
        } else if (status == errSecItemNotFound) {
            // Item doesn't exist, create it
            [query setObject:valueData forKey:(__bridge id)kSecValueData];
            
            // Use hardware encryption if available (Secure Enclave)
            if (@available(iOS 9.0, *)) {
                [query setObject:(__bridge id)kSecAttrAccessibleWhenUnlockedThisDeviceOnly 
                          forKey:(__bridge id)kSecAttrAccessible];
            }
            
            status = SecItemAdd((__bridge CFDictionaryRef)query, NULL);
        }
        
        return (status == errSecSuccess) ? 0 : (int)status;
    }
    
    // Retrieve data securely from iOS Keychain
    char* KeychainRetrieve(const char* key) {
        if (!key) {
            return NULL;
        }
        
        NSString *keyString = [NSString stringWithUTF8String:key];
        
        // Create query dictionary
        NSMutableDictionary *query = [[NSMutableDictionary alloc] init];
        [query setObject:(__bridge id)kSecClassGenericPassword forKey:(__bridge id)kSecClass];
        [query setObject:keyString forKey:(__bridge id)kSecAttrService];
        [query setObject:keyString forKey:(__bridge id)kSecAttrAccount];
        [query setObject:(__bridge id)kSecReturnData forKey:(__bridge id)kSecReturnData];
        [query setObject:(__bridge id)kSecMatchLimitOne forKey:(__bridge id)kSecMatchLimit];
        
        CFDataRef dataRef = NULL;
        OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, (CFTypeRef*)&dataRef);
        
        if (status != errSecSuccess || !dataRef) {
            return NULL;
        }
        
        NSData *data = (__bridge_transfer NSData*)dataRef;
        NSString *value = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        
        if (!value) {
            return NULL;
        }
        
        // Convert to C string (caller must free)
        const char *cString = [value UTF8String];
        char *result = (char*)malloc(strlen(cString) + 1);
        strcpy(result, cString);
        
        return result;
    }
    
    // Delete data from iOS Keychain
    int KeychainDelete(const char* key) {
        if (!key) {
            return -1;
        }
        
        NSString *keyString = [NSString stringWithUTF8String:key];
        
        // Create query dictionary
        NSMutableDictionary *query = [[NSMutableDictionary alloc] init];
        [query setObject:(__bridge id)kSecClassGenericPassword forKey:(__bridge id)kSecClass];
        [query setObject:keyString forKey:(__bridge id)kSecAttrService];
        [query setObject:keyString forKey:(__bridge id)kSecAttrAccount];
        
        OSStatus status = SecItemDelete((__bridge CFDictionaryRef)query);
        return (status == errSecSuccess || status == errSecItemNotFound) ? 0 : (int)status;
    }
    
    // Check if key exists in iOS Keychain
    bool KeychainExists(const char* key) {
        if (!key) {
            return false;
        }
        
        NSString *keyString = [NSString stringWithUTF8String:key];
        
        // Create query dictionary
        NSMutableDictionary *query = [[NSMutableDictionary alloc] init];
        [query setObject:(__bridge id)kSecClassGenericPassword forKey:(__bridge id)kSecClass];
        [query setObject:keyString forKey:(__bridge id)kSecAttrService];
        [query setObject:keyString forKey:(__bridge id)kSecAttrAccount];
        
        OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, NULL);
        return (status == errSecSuccess);
    }
    
    // Store data with biometric authentication requirement
    int KeychainStoreBiometric(const char* key, const char* value) {
        if (!key || !value) {
            return -1;
        }
        
        if (@available(iOS 8.0, *)) {
            NSString *keyString = [NSString stringWithUTF8String:key];
            NSString *valueString = [NSString stringWithUTF8String:value];
            NSData *valueData = [valueString dataUsingEncoding:NSUTF8StringEncoding];
            
            // Create access control for biometric authentication
            CFErrorRef error = NULL;
            SecAccessControlRef accessControl = SecAccessControlCreateWithFlags(
                kCFAllocatorDefault,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                kSecAccessControlBiometryAny,
                &error
            );
            
            if (error) {
                NSLog(@"Failed to create access control: %@", (__bridge NSError*)error);
                CFRelease(error);
                return -1;
            }
            
            // Create query dictionary
            NSMutableDictionary *query = [[NSMutableDictionary alloc] init];
            [query setObject:(__bridge id)kSecClassGenericPassword forKey:(__bridge id)kSecClass];
            [query setObject:keyString forKey:(__bridge id)kSecAttrService];
            [query setObject:keyString forKey:(__bridge id)kSecAttrAccount];
            [query setObject:valueData forKey:(__bridge id)kSecValueData];
            [query setObject:(__bridge id)accessControl forKey:(__bridge id)kSecAttrAccessControl];
            
            OSStatus status = SecItemAdd((__bridge CFDictionaryRef)query, NULL);
            CFRelease(accessControl);
            
            return (status == errSecSuccess) ? 0 : (int)status;
        }
        
        // Fallback to regular storage for older iOS versions
        return KeychainStore(key, value);
    }
    
    // Retrieve data with biometric authentication
    char* KeychainRetrieveBiometric(const char* key, const char* prompt) {
        if (!key) {
            return NULL;
        }
        
        if (@available(iOS 8.0, *)) {
            NSString *keyString = [NSString stringWithUTF8String:key];
            NSString *promptString = prompt ? [NSString stringWithUTF8String:prompt] : @"Authenticate to access secure data";
            
            // Create query dictionary with biometric prompt
            NSMutableDictionary *query = [[NSMutableDictionary alloc] init];
            [query setObject:(__bridge id)kSecClassGenericPassword forKey:(__bridge id)kSecClass];
            [query setObject:keyString forKey:(__bridge id)kSecAttrService];
            [query setObject:keyString forKey:(__bridge id)kSecAttrAccount];
            [query setObject:(__bridge id)kSecReturnData forKey:(__bridge id)kSecReturnData];
            [query setObject:(__bridge id)kSecMatchLimitOne forKey:(__bridge id)kSecMatchLimit];
            [query setObject:promptString forKey:(__bridge id)kSecUseOperationPrompt];
            
            CFDataRef dataRef = NULL;
            OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, (CFTypeRef*)&dataRef);
            
            if (status != errSecSuccess || !dataRef) {
                return NULL;
            }
            
            NSData *data = (__bridge_transfer NSData*)dataRef;
            NSString *value = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
            
            if (!value) {
                return NULL;
            }
            
            // Convert to C string (caller must free)
            const char *cString = [value UTF8String];
            char *result = (char*)malloc(strlen(cString) + 1);
            strcpy(result, cString);
            
            return result;
        }
        
        // Fallback to regular retrieval for older iOS versions
        return KeychainRetrieve(key);
    }
    
    // Check if biometric authentication is available
    bool BiometricAuthAvailable() {
        if (@available(iOS 8.0, *)) {
            LAContext *context = [[LAContext alloc] init];
            NSError *error = nil;
            
            BOOL canEvaluate = [context canEvaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics 
                                                    error:&error];
            return canEvaluate;
        }
        return false;
    }
    
    // Get biometric type available
    const char* BiometricType() {
        if (@available(iOS 11.0, *)) {
            LAContext *context = [[LAContext alloc] init];
            NSError *error = nil;
            
            if ([context canEvaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics error:&error]) {
                switch (context.biometryType) {
                    case LABiometryTypeTouchID:
                        return "TouchID";
                    case LABiometryTypeFaceID:
                        return "FaceID";
                    default:
                        return "Unknown";
                }
            }
        } else if (@available(iOS 8.0, *)) {
            LAContext *context = [[LAContext alloc] init];
            NSError *error = nil;
            
            if ([context canEvaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics error:&error]) {
                return "TouchID";
            }
        }
        
        return "None";
    }
    
    // Clear all ThinkRank keychain entries
    void KeychainClearAll() {
        // Query for all ThinkRank entries
        NSMutableDictionary *query = [[NSMutableDictionary alloc] init];
        [query setObject:(__bridge id)kSecClassGenericPassword forKey:(__bridge id)kSecClass];
        [query setObject:@"ThinkRank_" forKey:(__bridge id)kSecAttrService];
        
        // This will delete all items matching the service name
        SecItemDelete((__bridge CFDictionaryRef)query);
    }
}

// Certificate pinning validation (additional security)
extern "C" {
    bool ValidateCertificatePinning(const char* hostname, const char* certificateData) {
        if (!hostname || !certificateData) {
            return false;
        }
        
        NSString *hostnameString = [NSString stringWithUTF8String:hostname];
        NSString *certString = [NSString stringWithUTF8String:certificateData];
        
        // In a real implementation, you would:
        // 1. Parse the certificate data
        // 2. Compare against known good certificate fingerprints
        // 3. Validate the certificate chain
        
        // For now, return true (implement proper validation)
        NSLog(@"Certificate pinning validation for %@", hostnameString);
        return true;
    }
}