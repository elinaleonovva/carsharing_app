from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_alter_user_email"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="driver_license_number",
            field=models.CharField(blank=True, max_length=13, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="user",
            name="patronymic",
            field=models.CharField(blank=True, max_length=150),
        ),
    ]
