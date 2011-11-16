APPNAME=net.effjot.mensaplanswf
VERSION=0.6.1

MOJOIPK=$(APPNAME)_$(VERSION)_all.ipk


MOJOSRCDIR=mojo


.PHONY: all clean package launch install


all: package

clean:
	rm -f $(MOJOIPK)

launch: install
	palm-launch -c $(APPNAME)
	palm-launch $(APPNAME)

install: package
	palm-install -r $(APPNAME) || true 	# ignore error when already uninstalled
	palm-install $(MOJOIPK)

package: $(MOJOIPK)


$(MOJOIPK):
	palm-package --exclude-from=.palm-package.exclude $(MOJOSRCDIR)


