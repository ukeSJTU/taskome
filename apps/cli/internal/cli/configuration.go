package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
)

// DefaultGatewayURL is supplied by release builds through -ldflags.
var DefaultGatewayURL = ""

type configuration interface {
	gatewayURL() (string, error)
	setGatewayURL(string) error
}

type viperConfiguration struct {
	configPath string
	viper      *viper.Viper
}

func newConfiguration(configPath, defaultGatewayURL string) *viperConfiguration {
	settings := viper.New()
	settings.SetDefault("gateway_url", defaultGatewayURL)
	settings.SetConfigFile(configPath)
	settings.SetConfigType("yaml")
	return &viperConfiguration{configPath: configPath, viper: settings}
}

func defaultConfiguration() *viperConfiguration {
	if configPath := os.Getenv("TASKOME_CONFIG_FILE"); configPath != "" {
		return newConfiguration(configPath, DefaultGatewayURL)
	}
	configDirectory, err := os.UserConfigDir()
	if err != nil {
		configDirectory = ".config"
	}
	return newConfiguration(filepath.Join(configDirectory, "taskome", "config.yaml"), DefaultGatewayURL)
}

func (configuration *viperConfiguration) gatewayURL() (string, error) {
	if err := configuration.read(); err != nil {
		return "", err
	}
	url := strings.TrimRight(strings.TrimSpace(configuration.viper.GetString("gateway_url")), "/")
	if url == "" {
		return "", fmt.Errorf("gateway_url is not configured")
	}
	return url, nil
}

func (configuration *viperConfiguration) setGatewayURL(value string) error {
	url := strings.TrimRight(strings.TrimSpace(value), "/")
	if url == "" {
		return fmt.Errorf("gateway_url must not be empty")
	}
	if err := configuration.read(); err != nil {
		return err
	}
	configuration.viper.Set("gateway_url", url)
	if err := os.MkdirAll(filepath.Dir(configuration.configPath), 0o700); err != nil {
		return fmt.Errorf("create configuration directory: %w", err)
	}
	if err := configuration.viper.WriteConfigAs(configuration.configPath); err != nil {
		return fmt.Errorf("write configuration: %w", err)
	}
	return nil
}

func (configuration *viperConfiguration) read() error {
	err := configuration.viper.ReadInConfig()
	if err == nil || isConfigNotFound(err) {
		return nil
	}
	return fmt.Errorf("read configuration: %w", err)
}

func isConfigNotFound(err error) bool {
	_, ok := err.(viper.ConfigFileNotFoundError)
	return ok || os.IsNotExist(err)
}
