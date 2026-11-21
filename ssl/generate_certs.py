"""Generate self-signed SSL certificates for local development."""
import os
import sys
import datetime
import ipaddress

try:
    from cryptography import x509
    from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
except ImportError:
    print("Installing cryptography package...")
    os.system(f"{sys.executable} -m pip install cryptography")
    from cryptography import x509
    from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization

def generate_self_signed_cert():
    """Generate a proper self-signed certificate for localhost."""
    
    # Generate private key (2048 bits)
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    # Certificate subject and issuer
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Development"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "Local"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "BusinessManager"),
        x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
    ])
    
    # Valid from now to 1 year from now
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Build certificate with all necessary extensions
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=365))
        # Subject Alternative Names - REQUIRED for modern browsers
        # Includes localhost and local network IPs
        .add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.DNSName("*.localhost"),
                x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                x509.IPAddress(ipaddress.IPv6Address("::1")),
                # Local network IPs - add your machine's IP here
                x509.IPAddress(ipaddress.IPv4Address("192.168.4.118")),
                # Common private network ranges
                x509.IPAddress(ipaddress.IPv4Address("192.168.1.1")),
                x509.IPAddress(ipaddress.IPv4Address("10.0.0.1")),
            ]),
            critical=False,
        )
        # Basic Constraints - mark as CA for self-signed
        .add_extension(
            x509.BasicConstraints(ca=True, path_length=0),
            critical=True,
        )
        # Key Usage
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_encipherment=True,
                key_cert_sign=True,
                key_agreement=False,
                content_commitment=False,
                data_encipherment=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        # Extended Key Usage - for TLS
        .add_extension(
            x509.ExtendedKeyUsage([
                ExtendedKeyUsageOID.SERVER_AUTH,
                ExtendedKeyUsageOID.CLIENT_AUTH,
            ]),
            critical=False,
        )
        .sign(key, hashes.SHA256(), default_backend())
    )
    
    # Get the directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Write private key
    key_path = os.path.join(script_dir, "key.pem")
    with open(key_path, "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))
    print(f"Private key saved to: {key_path}")
    
    # Write certificate
    cert_path = os.path.join(script_dir, "cert.pem")
    with open(cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    print(f"Certificate saved to: {cert_path}")
    
    print("\n" + "="*60)
    print("SSL certificates generated successfully!")
    print("="*60)
    print("\nTo trust this certificate in your browser:")
    print("1. Open https://localhost:5173")
    print("2. Click 'Advanced' or 'Show Details'")
    print("3. Click 'Proceed to localhost' or 'Accept Risk'")
    print("\nOr install the certificate to your system trust store:")
    print(f"   Windows: Double-click {cert_path}")
    print("            -> Install Certificate -> Local Machine")
    print("            -> Place in 'Trusted Root Certification Authorities'")

if __name__ == "__main__":
    generate_self_signed_cert()
